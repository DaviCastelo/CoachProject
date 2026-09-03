-- G2/G3/G4/G5 — RPCs que fecham os fluxos de ponta a ponta.
-- Todas SECURITY DEFINER com checagem de autorização explícita no corpo.

-- ---------------------------------------------------------------------------
-- G2 — Aprovar inscrição e atribuir a 1..N grupos (brief §5, §22)
-- ---------------------------------------------------------------------------

create or replace function approve_registration_with_groups(
  p_registration_id uuid,
  p_group_ids       uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_athlete uuid; v_gid uuid;
begin
  select organization_id, athlete_id into v_org, v_athlete
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
end $$;

-- ---------------------------------------------------------------------------
-- G3 — Publicar evento: materializa os convites de RSVP (brief §8, §13)
-- ---------------------------------------------------------------------------

create or replace function publish_session(p_session_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_count int;
begin
  select organization_id into v_org from sessions where id = p_session_id;
  if v_org is null then raise exception 'session_not_found'; end if;

  if not can_manage_session(p_session_id) then
    raise exception 'forbidden';
  end if;

  -- Um atleta em 2 grupos convidados recebe UM convite só (unique + do nothing).
  insert into session_attendance (organization_id, session_id, athlete_id)
  select distinct v_org, p_session_id, gm.athlete_id
    from session_groups sg
    join group_members gm
      on gm.group_id = sg.group_id
      or (sg.include_subgroups and gm.group_id in (select group_descendants(sg.group_id)))
   where sg.session_id = p_session_id
     and gm.left_at is null
     and gm.status in ('active','trial')
  on conflict (session_id, athlete_id) do nothing;

  get diagnostics v_count = row_count;

  update sessions set published_at = coalesce(published_at, now()), updated_at = now()
   where id = p_session_id;

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- G4 — RSVP: o atleta responde, ou o responsável responde POR ELE (brief §11, §12)
-- ---------------------------------------------------------------------------

create or replace function respond_rsvp(
  p_session_id uuid,
  p_athlete_id uuid,
  p_status     text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if p_status not in ('invited','confirmed','declined') then
    raise exception 'invalid_rsvp_status';
  end if;

  -- Só responde por atleta sob sua responsabilidade (ou sendo o próprio atleta).
  if p_athlete_id not in (select auth_athlete_ids()) then
    raise exception 'forbidden';
  end if;

  select organization_id into v_org from sessions where id = p_session_id;
  if v_org is null then raise exception 'session_not_found'; end if;

  insert into session_attendance (
    organization_id, session_id, athlete_id, status, responded_at, responded_by
  )
  values (v_org, p_session_id, p_athlete_id, p_status::attendance_status, now(), auth.uid())
  on conflict (session_id, athlete_id) do update
    set status = excluded.status,
        responded_at = now(),
        responded_by = auth.uid(),   -- auditoria: QUEM respondeu
        updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- G5 — Enviar anúncio: resolve e materializa destinatários (brief §14, §16)
-- ---------------------------------------------------------------------------

create or replace function send_announcement(p_announcement_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_status announcement_status; v_is_admin boolean; v_count int;
begin
  select organization_id, status into v_org, v_status
    from announcements where id = p_announcement_id;
  if v_org is null then raise exception 'announcement_not_found'; end if;
  if v_status = 'sent' then raise exception 'already_sent'; end if;

  v_is_admin := has_org_role(v_org, array['owner','admin']::org_role[]);

  if not v_is_admin and not can_manage_announcement(p_announcement_id) then
    raise exception 'forbidden';
  end if;

  -- Coach só envia para grupos que treina.
  if not v_is_admin then
    if exists (
      select 1 from announcement_groups ag
       where ag.announcement_id = p_announcement_id
         and ag.group_id not in (select auth_coach_group_ids())
    ) then
      raise exception 'group_not_owned';
    end if;
  end if;

  -- Grupos-alvo, expandindo subgrupos quando marcado.
  with target_groups as (
    select distinct g.gid from (
      select ag.group_id as gid from announcement_groups ag
       where ag.announcement_id = p_announcement_id
      union
      select d.id from announcement_groups ag
        cross join lateral group_descendants(ag.group_id) as d(id)
       where ag.announcement_id = p_announcement_id and ag.include_subgroups
    ) g
  ),
  target_athletes as (
    select distinct gm.athlete_id
      from group_members gm join target_groups tg on tg.gid = gm.group_id
     where gm.left_at is null and gm.status in ('active','trial')
  ),
  recipients as (
    -- o próprio atleta, quando tem conta
    select a.user_id as profile_id, a.id as athlete_id
      from athletes a join target_athletes ta on ta.athlete_id = a.id
     where a.user_id is not null
    union
    -- responsáveis que aceitam comunicação (flag já existente em guardian_athletes)
    select gu.user_id as profile_id, ga.athlete_id
      from guardian_athletes ga
      join guardians gu on gu.id = ga.guardian_id
      join target_athletes ta on ta.athlete_id = ga.athlete_id
     where gu.user_id is not null and ga.can_receive_comms
    union
    -- coaches dos grupos-alvo
    select gc.coach_id as profile_id, null::uuid as athlete_id
      from group_coaches gc join target_groups tg on tg.gid = gc.group_id
  )
  insert into announcement_recipients (announcement_id, profile_id, athlete_id)
  -- Um profile recebe uma vez só. Não existe min(uuid) no Postgres, então
  -- escolhemos o primeiro athlete_id não nulo (o coach entra com athlete_id nulo).
  select p_announcement_id,
         r.profile_id,
         (array_remove(array_agg(r.athlete_id), null))[1]
    from recipients r
   group by r.profile_id
  on conflict (announcement_id, profile_id) do nothing;

  get diagnostics v_count = row_count;

  update announcements
     set status = 'sent', sent_at = now(), updated_at = now()
   where id = p_announcement_id;

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Grants — apenas usuários autenticados; a autorização real está no corpo.
-- ---------------------------------------------------------------------------

revoke all on function approve_registration_with_groups(uuid, uuid[]) from public, anon;
revoke all on function publish_session(uuid)                          from public, anon;
revoke all on function respond_rsvp(uuid, uuid, text)                 from public, anon;
revoke all on function send_announcement(uuid)                        from public, anon;

grant execute on function approve_registration_with_groups(uuid, uuid[]) to authenticated;
grant execute on function publish_session(uuid)                          to authenticated;
grant execute on function respond_rsvp(uuid, uuid, text)                 to authenticated;
grant execute on function send_announcement(uuid)                        to authenticated;
