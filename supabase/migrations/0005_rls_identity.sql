alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table memberships     enable row level security;
alter table households       enable row level security;
alter table guardians        enable row level security;
alter table athletes         enable row level security;
alter table guardian_athletes enable row level security;
alter table locations        enable row level security;
alter table org_settings     enable row level security;

create policy org_member_read on organizations
  for select using (id in (select auth_org_ids()));
create policy org_admin_update on organizations
  for update using (has_org_role(id, array['owner','admin']::org_role[]))
  with check (has_org_role(id, array['owner','admin']::org_role[]));

create policy profile_self_read on profiles
  for select using (id = auth.uid());
create policy profile_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy membership_self_read on memberships
  for select using (user_id = auth.uid());
create policy membership_admin_read on memberships
  for select using (is_staff(organization_id));
create policy membership_admin_write on memberships
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy household_staff_all on households
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy household_family_read on households
  for select using (
    id in (select g.household_id from guardians g where g.user_id = auth.uid())
  );

create policy guardian_staff_all on guardians
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy guardian_self_read on guardians
  for select using (user_id = auth.uid());

create policy athlete_staff_all on athletes
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy athlete_family_read on athletes
  for select using (id in (select auth_athlete_ids()));
create policy athlete_family_update on athletes
  for update using (id in (select auth_athlete_ids()))
  with check (id in (select auth_athlete_ids()));

create policy ga_staff_all on guardian_athletes
  for all using (
    exists (select 1 from guardians g
             where g.id = guardian_athletes.guardian_id and is_staff(g.organization_id))
  ) with check (
    exists (select 1 from guardians g
             where g.id = guardian_athletes.guardian_id and is_staff(g.organization_id))
  );
create policy ga_family_read on guardian_athletes
  for select using (
    guardian_id in (select id from guardians where user_id = auth.uid())
  );

create policy location_staff_all on locations
  for all using (is_staff(organization_id)) with check (is_staff(organization_id));
create policy location_member_read on locations
  for select using (organization_id in (select auth_org_ids()) and is_active);

create policy org_settings_read on org_settings
  for select using (organization_id in (select auth_org_ids()));
create policy org_settings_write on org_settings
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));
