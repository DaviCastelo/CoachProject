-- G0 — RLS de grupos, membership e coaches.
-- Regra estruturante (brief §7): a autoridade do coach é DERIVADA de group_coaches,
-- não do papel global. Coach é "admin" apenas dentro dos grupos dele.
-- Os helpers can_manage_group/auth_* são SECURITY DEFINER e por isso não disparam
-- recursão de policy ao consultarem group_coaches/group_members.

alter table group_members enable row level security;
alter table group_coaches enable row level security;

-- ---------------------------------------------------------------------------
-- groups — refina a policy da 0011 (que dava ALL a qualquer staff, coach incluso)
-- ---------------------------------------------------------------------------

drop policy if exists groups_staff_all on groups;

-- Só owner/admin criam, editam e arquivam grupos.
create policy groups_admin_write on groups
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

-- Staff (incl. coach) enxerga a estrutura de grupos da organização.
create policy groups_staff_read on groups
  for select using (is_staff(organization_id));

-- Família enxerga apenas os grupos dos seus atletas.
create policy groups_family_read on groups
  for select using (id in (select auth_family_group_ids()));

-- ---------------------------------------------------------------------------
-- group_members — roster
-- ---------------------------------------------------------------------------

-- Admin da org: tudo.
create policy group_members_admin_all on group_members
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

-- Coach: gerencia o roster apenas dos grupos que treina.
create policy group_members_coach_all on group_members
  for all using (can_manage_group(group_id))
  with check (can_manage_group(group_id));

-- Staff não-coach: leitura.
create policy group_members_staff_read on group_members
  for select using (is_staff(organization_id));

-- Família: vê apenas as participações dos próprios atletas.
create policy group_members_family_read on group_members
  for select using (athlete_id in (select auth_athlete_ids()));

-- ---------------------------------------------------------------------------
-- group_coaches — quem treina o quê (só admin escreve)
-- ---------------------------------------------------------------------------

create policy group_coaches_admin_all on group_coaches
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy group_coaches_staff_read on group_coaches
  for select using (is_staff(organization_id));

-- ---------------------------------------------------------------------------
-- Grants (RLS continua controlando as linhas)
-- ---------------------------------------------------------------------------

grant usage on type group_member_status to authenticated;
grant select, insert, update, delete on group_members to authenticated;
grant select, insert, update, delete on group_coaches to authenticated;
grant all on group_members, group_coaches to postgres, service_role;
