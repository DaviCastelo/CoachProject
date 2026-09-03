-- G3/G4 — Agenda com evento multi-grupo + RSVP.
-- Brief §8, §10, §11, §12, §13: um evento pode pertencer a VÁRIOS grupos e o RSVP
-- pertence sempre ao ATLETA (o responsável apenas responde em nome dele).

do $$ begin
  create type session_status as enum ('scheduled','canceled','completed');
exception when duplicate_object then null;
end $$;

-- 'invited' = SEM RESPOSTA (default). 'confirmed' = Going. 'declined' = Not Going.
-- Os demais valores são da chamada feita pelo coach, não do RSVP da família.
do $$ begin
  create type attendance_status as enum
    ('invited','confirmed','declined','present','absent','late','excused','no_show');
exception when duplicate_object then null;
end $$;

create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  title            text not null,
  description      text,
  event_type       text not null default 'training',   -- training | match | tryout | meeting
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  location_id      uuid references locations(id) on delete set null,
  field_label      text,
  status           session_status not null default 'scheduled',
  published_at     timestamptz,
  canceled_at      timestamptz,
  canceled_by      uuid references profiles(id),
  cancellation_reason text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint session_time_valid check (ends_at > starts_at)
);

create index if not exists sessions_org_starts_idx on sessions (organization_id, starts_at);

-- Evento <-> grupos (M:N). Substitui o antigo sessions.group_id do plano original.
create table if not exists session_groups (
  session_id        uuid not null references sessions(id) on delete cascade,
  group_id          uuid not null references groups(id) on delete cascade,
  include_subgroups boolean not null default false,
  primary key (session_id, group_id)
);

create index if not exists session_groups_group_idx on session_groups (group_id);

-- RSVP / presença — uma linha por (evento, atleta).
create table if not exists session_attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references sessions(id) on delete cascade,
  athlete_id      uuid not null references athletes(id) on delete cascade,
  status          attendance_status not null default 'invited',
  responded_at    timestamptz,
  responded_by    uuid references profiles(id),   -- quem respondeu (pai OU o próprio atleta)
  checked_in_at   timestamptz,
  checked_in_by   uuid references profiles(id),
  coach_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Atleta que pertence a 2 grupos convidados recebe UM convite só.
  unique (session_id, athlete_id)
);

create index if not exists session_attendance_athlete_idx on session_attendance (athlete_id);
create index if not exists session_attendance_session_idx on session_attendance (session_id, status);

-- ---------------------------------------------------------------------------
-- Helpers de autorização
-- ---------------------------------------------------------------------------

-- Pode editar o evento? admin da org OU coach de algum grupo participante.
create or replace function can_manage_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sessions s
     where s.id = p_session_id
       and has_org_role(s.organization_id, array['owner','admin']::org_role[])
  )
  or exists (
    select 1 from session_groups sg
     join group_coaches gc on gc.group_id = sg.group_id
    where sg.session_id = p_session_id and gc.coach_id = auth.uid()
  );
$$;

-- A família enxerga o evento? (algum grupo do evento contém um atleta dela)
create or replace function can_view_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_attendance sa
     where sa.session_id = p_session_id
       and sa.athlete_id in (select auth_athlete_ids())
  )
  or exists (
    select 1 from session_groups sg
     where sg.session_id = p_session_id
       and sg.group_id in (select auth_family_group_ids())
  );
$$;

grant execute on function can_manage_session(uuid) to authenticated;
grant execute on function can_view_session(uuid)   to authenticated;
