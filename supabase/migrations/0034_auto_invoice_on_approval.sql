-- Fase 4 (P1) — emissão automática de fatura na aprovação.
--
-- Dá função ao `forms.requires_payment`, que existia no construtor de
-- formulários como checkbox sem nada atrás: era possível marcar "este
-- formulário exige pagamento" e absolutamente nada acontecia.
--
-- Agora ele é a chave:
--
--   requires_payment = true   aprovar a inscrição emite a fatura na hora
--   requires_payment = false  emissão manual, pela fila em /coach/payments
--
-- A alternativa era remover a coluna. Ligar é melhor: o formulário é o lugar
-- onde a pessoa já declara se aquilo é pago, e repetir essa decisão em outro
-- canto seria pedir para as duas divergirem.

create or replace function approve_registration_with_groups(
  p_registration_id uuid,
  p_group_ids       uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_athlete uuid; v_gid uuid;
  v_invoice_id uuid;
  v_option_id  uuid;
  v_requires_payment boolean;
  v_price int;
begin
  select organization_id, athlete_id, invoice_id, program_option_id
    into v_org, v_athlete, v_invoice_id, v_option_id
    from registrations where id = p_registration_id;

  if v_org is null then
    raise exception 'registration_not_found';
  end if;

  if not has_org_role(v_org, array['owner','admin']::org_role[]) then
    raise exception 'forbidden';
  end if;

  update registrations
     set status = 'approved', approved_at = now(), approved_by = auth.uid(),
         canceled_at = null, updated_at = now()
   where id = p_registration_id;

  -- A inscrição aceita ativa o atleta (brief §22, passo 3).
  update athletes set status = 'active', updated_at = now()
   where id = v_athlete and status <> 'active';

  foreach v_gid in array coalesce(p_group_ids, '{}'::uuid[]) loop
    -- O grupo precisa ser da mesma organização.
    if not exists (select 1 from groups g where g.id = v_gid and g.organization_id = v_org) then
      raise exception 'group_not_in_org';
    end if;

    insert into group_members (organization_id, group_id, athlete_id, added_by)
    values (v_org, v_gid, v_athlete, auth.uid())
    on conflict (group_id, athlete_id) do update
      set status = 'active', left_at = null, updated_at = now();
  end loop;

  -- -------------------------------------------------------------------------
  -- Emissão automática da fatura
  -- -------------------------------------------------------------------------

  if v_invoice_id is not null then
    return;  -- já faturada: nada a fazer
  end if;

  -- O formulário de origem decide. Caminho:
  -- registration -> form_submission -> form_version -> form
  select f.requires_payment into v_requires_payment
    from registrations r
    join form_submissions s on s.id = r.submission_id
    join form_versions v    on v.id = s.form_version_id
    join forms f            on f.id = v.form_id
   where r.id = p_registration_id;

  if not coalesce(v_requires_payment, false) then
    return;  -- formulário gratuito, ou inscrição criada fora de formulário
  end if;

  -- Sem opção de programa não há preço, e create_invoice_for_registration
  -- levanta exceção nesse caso. Aqui isso ABORTARIA A APROVAÇÃO inteira por
  -- causa de um preço faltando — o atleta não entraria no grupo.
  --
  -- A aprovação é a operação principal; a fatura é consequência. Então
  -- checamos antes e saímos quieto: a inscrição aparece na fila de
  -- "sem fatura" em /coach/payments para alguém resolver.
  if v_option_id is null then
    return;
  end if;

  select price_cents into v_price from program_options where id = v_option_id;
  if v_price is null then
    return;
  end if;

  perform create_invoice_for_registration(p_registration_id);
end $$;

revoke all on function approve_registration_with_groups(uuid, uuid[]) from public, anon;
grant execute on function approve_registration_with_groups(uuid, uuid[]) to authenticated;
