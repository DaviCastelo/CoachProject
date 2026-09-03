-- G3/G4 — RLS da agenda e do RSVP.

alter table sessions           enable row level security;
alter table session_groups     enable row level security;
alter table session_attendance enable row level security;

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

create policy sessions_admin_all on sessions
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

-- Coach cria eventos na sua org...
create policy sessions_coach_insert on sessions
  for insert with check (has_org_role(organization_id, array['coach']::org_role[]));

-- ...mas só edita/apaga os eventos dos grupos que treina.
create policy sessions_coach_update on sessions
  for update using (can_manage_session(id)) with check (can_manage_session(id));
create policy sessions_coach_delete on sessions
  for delete using (can_manage_session(id));

create policy sessions_staff_read on sessions
  for select using (is_staff(organization_id));

create policy sessions_family_read on sessions
  for select using (can_view_session(id));

-- ---------------------------------------------------------------------------
-- session_groups — quais grupos participam
-- ---------------------------------------------------------------------------

create policy session_groups_manage on session_groups
  for all using (can_manage_session(session_id))
  with check (can_manage_session(session_id));

create policy session_groups_staff_read on session_groups
  for select using (
    exists (select 1 from sessions s
             where s.id = session_groups.session_id and is_staff(s.organization_id))
  );

create policy session_groups_family_read on session_groups
  for select using (group_id in (select auth_family_group_ids()));

-- ---------------------------------------------------------------------------
-- session_attendance — RSVP e chamada
-- ---------------------------------------------------------------------------

create policy attendance_admin_all on session_attendance
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

-- Coach faz a chamada dos eventos que gerencia.
create policy attendance_coach_all on session_attendance
  for all using (can_manage_session(session_id))
  with check (can_manage_session(session_id));

create policy attendance_staff_read on session_attendance
  for select using (is_staff(organization_id));

-- Família lê o RSVP dos próprios atletas.
create policy attendance_family_read on session_attendance
  for select using (athlete_id in (select auth_athlete_ids()));

-- Família responde SOMENTE pelos próprios atletas e SOMENTE entre os três
-- estados de RSVP — não pode marcar presença/falta (isso é da chamada do coach).
create policy attendance_family_respond on session_attendance
  for update
  using (athlete_id in (select auth_athlete_ids()))
  with check (
    athlete_id in (select auth_athlete_ids())
    and status in ('invited','confirmed','declined')
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on type session_status    to authenticated;
grant usage on type attendance_status to authenticated;
grant select, insert, update, delete on sessions           to authenticated;
grant select, insert, update, delete on session_groups     to authenticated;
grant select, insert, update, delete on session_attendance to authenticated;
grant all on sessions, session_groups, session_attendance to postgres, service_role;
