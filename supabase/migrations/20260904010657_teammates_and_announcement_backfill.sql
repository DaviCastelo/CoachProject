-- 1) Companheiros de time e coaches para a família/atleta.
--
-- Não basta liberar `group_members` e `athletes` por RLS: a linha de `athletes`
-- carrega alergias e observações médicas, que NÃO devem vazar para os colegas.
-- Estas funções devolvem apenas o nome — o mínimo necessário para a tela.

create or replace function list_my_teammates()
returns table (group_id uuid, athlete_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select gm.group_id,
         a.id,
         a.first_name || ' ' || a.last_name
    from group_members gm
    join athletes a on a.id = gm.athlete_id
   where gm.group_id in (select auth_family_group_ids())
     and gm.left_at is null
     and gm.status in ('active','trial')
     and a.deleted_at is null;
$$;

create or replace function list_my_group_coaches()
returns table (group_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select gc.group_id,
         coalesce(p.full_name, p.email)
    from group_coaches gc
    join profiles p on p.id = gc.coach_id
   where gc.group_id in (select auth_family_group_ids());
$$;

revoke all on function list_my_teammates()      from public, anon;
revoke all on function list_my_group_coaches()  from public, anon;
grant execute on function list_my_teammates()     to authenticated;
grant execute on function list_my_group_coaches() to authenticated;

-- 2) Avisos anteriores à criação da conta.
--
-- Os destinatários são materializados no envio (para o histórico não mudar quando
-- o roster muda). Quem ganha login DEPOIS ficava sem ver nada. Esta função inclui
-- a pessoa nos avisos já enviados aos grupos em que o atleta dela está.

create or replace function backfill_announcements_for_athlete(
  p_user_id uuid,
  p_athlete_id uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into announcement_recipients (announcement_id, profile_id, athlete_id)
  select distinct a.id, p_user_id, p_athlete_id
    from announcements a
    join announcement_groups ag on ag.announcement_id = a.id
    join group_members gm
      on gm.group_id = ag.group_id
      or (ag.include_subgroups and gm.group_id in (select group_descendants(ag.group_id)))
   where a.status = 'sent'
     and gm.athlete_id = p_athlete_id
     and gm.left_at is null
  on conflict (announcement_id, profile_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function backfill_announcements_for_athlete(uuid, uuid) from public, anon;
grant execute on function backfill_announcements_for_athlete(uuid, uuid)
  to authenticated, service_role;
