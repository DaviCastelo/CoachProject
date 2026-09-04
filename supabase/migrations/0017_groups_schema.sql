-- G0 — Grupos hierárquicos + membership (players e coaches).
-- Base de tudo: agenda, RSVP e comunicação dependem destas tabelas.
-- Brief do cliente 2026-09-03 §1, §4, §6. Ver Obsidian: Plano-Grupos-Rosters-Agenda-Comunicacao.

-- ---------------------------------------------------------------------------
-- 1. Hierarquia de grupos (subgrupos)
-- ---------------------------------------------------------------------------

alter table groups
  add column if not exists parent_group_id uuid references groups(id) on delete restrict,
  add column if not exists sort_order int not null default 0;

create index if not exists groups_org_parent_idx on groups (organization_id, parent_group_id);

-- Impede ciclo (A -> B -> A), auto-referência e profundidade excessiva.
create or replace function check_group_cycle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cursor uuid := new.parent_group_id;
  v_depth  int  := 0;
begin
  if new.parent_group_id is null then
    return new;
  end if;

  if new.parent_group_id = new.id then
    raise exception 'group_cycle: a group cannot be its own parent';
  end if;

  while v_cursor is not null loop
    v_depth := v_depth + 1;
    if v_cursor = new.id then
      raise exception 'group_cycle: hierarchy cycle detected';
    end if;
    if v_depth > 5 then
      raise exception 'group_depth: hierarchy too deep (max 5 levels)';
    end if;
    select parent_group_id into v_cursor from groups where id = v_cursor;
  end loop;

  return new;
end $$;

drop trigger if exists groups_no_cycle on groups;
create trigger groups_no_cycle
  before insert or update of parent_group_id on groups
  for each row execute function check_group_cycle();

-- Um grupo e todos os seus descendentes (usado por eventos e anúncios em lote).
create or replace function group_descendants(p_group_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select id from groups where id = p_group_id
    union all
    select g.id from groups g join tree t on g.parent_group_id = t.id
  )
  select id from tree;
$$;

-- ---------------------------------------------------------------------------
-- 2. Membership de players
-- ---------------------------------------------------------------------------

do $$ begin
  create type group_member_status as enum ('active','trial','waitlist','removed');
exception when duplicate_object then null;
end $$;

create table if not exists group_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  group_id        uuid not null references groups(id) on delete cascade,
  athlete_id      uuid not null references athletes(id) on delete cascade,
  status          group_member_status not null default 'active',
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  added_by        uuid references profiles(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (group_id, athlete_id)
);

create index if not exists group_members_org_group_idx on group_members (organization_id, group_id, status);
create index if not exists group_members_athlete_idx on group_members (athlete_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- 3. Coaches do grupo
-- ---------------------------------------------------------------------------

create table if not exists group_coaches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  group_id        uuid not null references groups(id) on delete cascade,
  coach_id        uuid not null references profiles(id) on delete cascade,
  is_lead         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (group_id, coach_id)
);

create index if not exists group_coaches_coach_idx on group_coaches (coach_id);

-- ---------------------------------------------------------------------------
-- 4. Helpers de autorização derivada do grupo
-- ---------------------------------------------------------------------------

-- Grupos que o usuário logado treina (autoridade do coach vem daqui, não do papel global).
create or replace function auth_coach_group_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select group_id from group_coaches where coach_id = auth.uid();
$$;

-- Grupos visíveis à família: os grupos ativos dos atletas sob responsabilidade do usuário.
create or replace function auth_family_group_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select gm.group_id from group_members gm
   where gm.athlete_id in (select auth_athlete_ids())
     and gm.left_at is null
     and gm.status in ('active','trial');
$$;

-- O usuário pode administrar este grupo? (admin da org OU coach do próprio grupo)
create or replace function can_manage_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from groups g
     where g.id = p_group_id
       and (
         has_org_role(g.organization_id, array['owner','admin']::org_role[])
         or exists (select 1 from group_coaches gc
                     where gc.group_id = g.id and gc.coach_id = auth.uid())
       )
  );
$$;

grant execute on function group_descendants(uuid)  to authenticated;
grant execute on function auth_coach_group_ids()   to authenticated;
grant execute on function auth_family_group_ids()  to authenticated;
grant execute on function can_manage_group(uuid)   to authenticated;
