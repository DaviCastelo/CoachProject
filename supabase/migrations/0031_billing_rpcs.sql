-- Fase 4 (P0) — RPCs de cobrança.
--
-- Três operações, cada uma com um dono diferente:
--
--   create_invoice_for_registration  admin/coach, pela tela
--   record_offline_payment           admin (e coach, se a org permitir)
--   apply_stripe_payment             só o servidor, chamada pelo webhook
--
-- Todas são SECURITY DEFINER e checam permissão por dentro. Definer sem
-- checagem explícita é porta dos fundos; o padrão aqui é sempre validar
-- primeiro e só então escrever.

-- ---------------------------------------------------------------------------
-- Recalcula o status da fatura a partir do que foi efetivamente pago.
-- ---------------------------------------------------------------------------

-- Espelha deriveInvoiceStatus() do domínio. Duplicar a regra em dois lugares
-- não é ideal, mas o webhook precisa fechar a fatura dentro da mesma transação
-- do pagamento — e `void`/`refunded`/`uncollectible` são decisões humanas que
-- nenhum dos dois lados pode desfazer sozinho.
create or replace function recalc_invoice_status(p_invoice_id uuid)
returns invoice_status language plpgsql security definer set search_path = public as $$
declare
  v_inv    invoices%rowtype;
  v_paid   int;
  v_status invoice_status;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'fatura % não encontrada', p_invoice_id;
  end if;

  if v_inv.status in ('void', 'refunded', 'uncollectible', 'draft') then
    return v_inv.status;
  end if;

  select coalesce(sum(amount_cents), 0) into v_paid
    from payments
   where invoice_id = p_invoice_id
     and status in ('succeeded', 'partially_refunded');

  v_status := case when v_paid >= v_inv.total_cents then 'paid' else 'open' end;

  update invoices
     set status = v_status, updated_at = now()
   where id = p_invoice_id;

  -- Fatura quitada solta a reserva: a vaga deixa de ser provisória e vira
  -- definitiva, então não há mais prazo correndo contra a família.
  if v_status = 'paid' then
    update registrations
       set reserved_until = null, updated_at = now()
     where invoice_id = p_invoice_id and reserved_until is not null;
  end if;

  return v_status;
end $$;

revoke all on function recalc_invoice_status(uuid) from public, anon, authenticated;
grant execute on function recalc_invoice_status(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- create_invoice_for_registration
-- ---------------------------------------------------------------------------

create or replace function create_invoice_for_registration(
  p_registration_id uuid,
  p_discount_cents  int default 0,
  p_discount_reason text default null,
  p_due_on          date default null,
  p_memo            text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_reg      registrations%rowtype;
  v_price    int;
  v_total    int;
  v_invoice  uuid;
  v_policy   jsonb;
  v_hours    numeric;
begin
  select * into v_reg from registrations where id = p_registration_id for update;
  if not found then
    raise exception 'inscrição % não encontrada', p_registration_id;
  end if;

  if not is_staff(v_reg.organization_id) then
    raise exception 'sem permissão para faturar nesta organização';
  end if;

  -- Idempotente: chamar duas vezes devolve a mesma fatura em vez de criar
  -- duas cobranças para a mesma inscrição.
  if v_reg.invoice_id is not null then
    return v_reg.invoice_id;
  end if;

  if v_reg.program_option_id is null then
    raise exception 'inscrição % não tem opção de programa, não há preço para faturar', p_registration_id;
  end if;

  select price_cents into v_price from program_options where id = v_reg.program_option_id;
  if v_price is null then
    raise exception 'opção de programa % sem preço', v_reg.program_option_id;
  end if;

  if p_discount_cents < 0 or p_discount_cents > v_price then
    raise exception 'desconto inválido: % sobre preço de %', p_discount_cents, v_price;
  end if;

  v_total := v_price - p_discount_cents;

  insert into invoices (
    organization_id, athlete_id, household_id, number, status,
    subtotal_cents, discount_cents, discount_reason, total_cents,
    due_on, memo, created_by
  )
  select
    v_reg.organization_id, v_reg.athlete_id, a.household_id,
    next_invoice_number(v_reg.organization_id), 'open',
    v_price, p_discount_cents, p_discount_reason, v_total,
    p_due_on, p_memo, auth.uid()
  from athletes a where a.id = v_reg.athlete_id
  returning id into v_invoice;

  -- Reserva de vaga conforme a política da organização (ver domínio:
  -- parseReservationPolicy). Ausente = padrão de 72 horas.
  select value into v_policy from org_settings
   where organization_id = v_reg.organization_id and key = 'payments.reservation';

  if coalesce(v_policy->>'mode', 'timed') = 'timed' then
    v_hours := coalesce(nullif(v_policy->>'hours', '')::numeric, 72);
    if v_hours > 0 then
      update registrations
         set invoice_id = v_invoice,
             reserved_until = now() + make_interval(hours => v_hours::int),
             updated_at = now()
       where id = p_registration_id;
      return v_invoice;
    end if;
  end if;

  -- 'none' e 'unlimited' não gravam prazo: a diferença entre os dois é lida
  -- da própria política na hora de decidir se a vaga está segura.
  update registrations
     set invoice_id = v_invoice, updated_at = now()
   where id = p_registration_id;

  return v_invoice;
end $$;

revoke all on function create_invoice_for_registration(uuid, int, text, date, text)
  from public, anon;
grant execute on function create_invoice_for_registration(uuid, int, text, date, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- record_offline_payment — a baixa manual do Venmo, dinheiro, cheque e Zelle
-- ---------------------------------------------------------------------------

create or replace function record_offline_payment(
  p_invoice_id   uuid,
  p_method       payment_method,
  p_amount_cents int,
  p_reference    text default null,
  p_paid_at      timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv      invoices%rowtype;
  v_payment  uuid;
  v_coach_ok boolean;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'fatura % não encontrada', p_invoice_id;
  end if;

  -- Quem pode dar baixa: owner/admin sempre. Coach só se a organização tiver
  -- ligado — é a pergunta que ficou em aberto com o cliente, e virou
  -- configuração em vez de decisão travada no código.
  if not has_org_role(v_inv.organization_id, array['owner','admin']::org_role[]) then
    select coalesce((value)::boolean, false) into v_coach_ok
      from org_settings
     where organization_id = v_inv.organization_id
       and key = 'payments.coach_can_record';

    if not (coalesce(v_coach_ok, false)
            and has_org_role(v_inv.organization_id, array['coach']::org_role[])) then
      raise exception 'sem permissão para registrar pagamento nesta organização';
    end if;
  end if;

  if p_method not in ('venmo','cash','check','zelle','account_credit','other') then
    raise exception '% não é método offline; pagamento de gateway entra pelo webhook', p_method;
  end if;

  if p_amount_cents <= 0 then
    raise exception 'valor do pagamento precisa ser positivo';
  end if;

  if v_inv.status in ('void', 'refunded') then
    raise exception 'fatura % está %, não aceita pagamento', v_inv.number, v_inv.status;
  end if;

  -- Offline já nasce 'succeeded': o dinheiro foi conferido por uma pessoa
  -- antes de alguém clicar. Não existe "processando" quando a confirmação é
  -- humana — ou viu o dinheiro, ou não marca.
  insert into payments (
    organization_id, invoice_id, provider, method, status,
    amount_cents, reference, recorded_by, paid_at
  ) values (
    v_inv.organization_id, p_invoice_id, 'offline', p_method, 'succeeded',
    p_amount_cents, p_reference, auth.uid(), coalesce(p_paid_at, now())
  )
  returning id into v_payment;

  perform recalc_invoice_status(p_invoice_id);

  return v_payment;
end $$;

revoke all on function record_offline_payment(uuid, payment_method, int, text, timestamptz)
  from public, anon;
grant execute on function record_offline_payment(uuid, payment_method, int, text, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- apply_stripe_payment — chamada apenas pelo webhook
-- ---------------------------------------------------------------------------

create or replace function apply_stripe_payment(
  p_invoice_id     uuid,
  p_external_id    text,
  p_method         payment_method,
  p_status         payment_status,
  p_amount_cents   int,
  p_fee_cents      int default null,
  p_paid_at        timestamptz default null,
  p_failure_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv     invoices%rowtype;
  v_payment uuid;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'fatura % não encontrada', p_invoice_id;
  end if;

  -- O upsert é a segunda linha de defesa da idempotência (a primeira é o
  -- unique em webhook_events). A Stripe manda payment_intent.succeeded mais de
  -- uma vez com frequência; aqui a repetição ATUALIZA o mesmo pagamento em vez
  -- de criar outro, então $600 nunca viram $1.200 na fatura.
  insert into payments (
    organization_id, invoice_id, provider, method, status,
    amount_cents, fee_cents, external_id, paid_at, failure_reason
  ) values (
    v_inv.organization_id, p_invoice_id, 'stripe', p_method, p_status,
    p_amount_cents, p_fee_cents, p_external_id, p_paid_at, p_failure_reason
  )
  on conflict (provider, external_id) where external_id is not null
  do update set
    status         = excluded.status,
    method         = excluded.method,
    -- A taxa real só chega quando a transação entra no saldo, depois do
    -- succeeded. Um evento mais novo sem taxa não pode apagar a que já veio.
    fee_cents      = coalesce(excluded.fee_cents, payments.fee_cents),
    paid_at        = coalesce(excluded.paid_at, payments.paid_at),
    failure_reason = excluded.failure_reason,
    updated_at     = now()
  returning id into v_payment;

  perform recalc_invoice_status(p_invoice_id);

  return v_payment;
end $$;

-- Nunca exposta a usuário: só o servidor, com a service role, aplica pagamento
-- de gateway. Se `authenticated` pudesse chamar, qualquer pessoa logada
-- marcaria a própria fatura como paga.
revoke all on function apply_stripe_payment(uuid, text, payment_method, payment_status, int, int, timestamptz, text)
  from public, anon, authenticated;
grant execute on function apply_stripe_payment(uuid, text, payment_method, payment_status, int, int, timestamptz, text)
  to service_role;
