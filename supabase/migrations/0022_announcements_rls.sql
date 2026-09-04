-- G5 — RLS dos anúncios.

alter table announcements           enable row level security;
alter table announcement_groups     enable row level security;
alter table announcement_recipients enable row level security;

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------

create policy announcements_admin_all on announcements
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

-- Coach escreve os próprios anúncios (a checagem de "só para os meus grupos"
-- é feita na RPC send_announcement, que valida cada grupo escolhido).
create policy announcements_coach_insert on announcements
  for insert with check (
    has_org_role(organization_id, array['coach']::org_role[]) and author_id = auth.uid()
  );
create policy announcements_author_update on announcements
  for update using (can_manage_announcement(id)) with check (can_manage_announcement(id));
create policy announcements_author_delete on announcements
  for delete using (can_manage_announcement(id) and status = 'draft');

-- Helpers SECURITY DEFINER: sem eles, a policy de `announcements` consultaria
-- `announcement_recipients` e vice-versa, causando recursão infinita de RLS.
create or replace function announcement_org(p_announcement_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from announcements where id = p_announcement_id;
$$;

create or replace function is_announcement_recipient(p_announcement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from announcement_recipients ar
     where ar.announcement_id = p_announcement_id
       and ar.profile_id = auth.uid()
  );
$$;

grant execute on function announcement_org(uuid)          to authenticated;
grant execute on function is_announcement_recipient(uuid) to authenticated;

-- Qualquer destinatário lê o anúncio que recebeu.
create policy announcements_recipient_read on announcements
  for select using (is_announcement_recipient(id));

create policy announcements_staff_read on announcements
  for select using (is_staff(organization_id));

-- ---------------------------------------------------------------------------
-- announcement_groups
-- ---------------------------------------------------------------------------

create policy announcement_groups_manage on announcement_groups
  for all using (can_manage_announcement(announcement_id))
  with check (can_manage_announcement(announcement_id));

create policy announcement_groups_staff_read on announcement_groups
  for select using (is_staff(announcement_org(announcement_id)));

-- ---------------------------------------------------------------------------
-- announcement_recipients
-- ---------------------------------------------------------------------------

create policy announcement_recipients_staff_read on announcement_recipients
  for select using (is_staff(announcement_org(announcement_id)));

-- O destinatário lê a própria linha e pode marcar como lida.
create policy announcement_recipients_self_read on announcement_recipients
  for select using (profile_id = auth.uid());
create policy announcement_recipients_self_update on announcement_recipients
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on type announcement_status to authenticated;
grant select, insert, update, delete on announcements           to authenticated;
grant select, insert, update, delete on announcement_groups     to authenticated;
grant select, insert, update, delete on announcement_recipients to authenticated;
grant all on announcements, announcement_groups, announcement_recipients
  to postgres, service_role;
