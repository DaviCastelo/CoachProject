-- Organização (tenant)
create table organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  legal_name        text,
  timezone          text not null default 'America/New_York',
  currency          char(3) not null default 'USD',
  locale            text not null default 'en-US',
  logo_url          text,
  brand_colors      jsonb default '{}',
  contact_email     text,
  contact_phone     text,
  address           jsonb,
  settings          jsonb not null default '{}',
  stripe_account_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Perfil espelhando auth.users (1:1)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  avatar_url    text,
  locale        text default 'en-US',
  timezone      text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Cria profile automaticamente quando um auth.user nasce
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create type org_role as enum ('owner','admin','coach','staff','guardian','athlete');

create table memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  role             org_role not null,
  status           text not null default 'active',
  invited_by       uuid references profiles(id),
  invited_at       timestamptz,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, user_id, role)
);
create index on memberships (user_id);
create index on memberships (organization_id, role);

-- Funções auxiliares de RLS
create or replace function auth_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from memberships
  where user_id = auth.uid() and status = 'active'
$$;

create or replace function has_org_role(org uuid, roles org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org
      and status = 'active' and role = any(roles)
  )
$$;

create or replace function is_staff(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_org_role(org, array['owner','admin','coach','staff']::org_role[])
$$;
