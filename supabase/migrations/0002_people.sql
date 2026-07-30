create table households (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text,
  primary_email    text,
  primary_phone    text,
  address          jsonb,
  billing_notes    text,
  account_balance  numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table guardians (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  household_id     uuid references households(id) on delete set null,
  user_id          uuid references profiles(id) on delete set null,
  first_name       text not null,
  last_name        text not null,
  email            text not null,
  phone            text,
  relationship     text,
  is_primary       boolean not null default false,
  is_emergency     boolean not null default true,
  preferred_language text default 'en',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on guardians (organization_id, lower(email));

create type athlete_status as enum ('prospect','trial','active','paused','inactive','alumni');

create table athletes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  household_id      uuid references households(id) on delete set null,
  user_id           uuid references profiles(id) on delete set null,
  first_name        text not null,
  last_name         text not null,
  preferred_name    text,
  date_of_birth     date not null,
  gender            text,
  photo_url         text,
  status            athlete_status not null default 'prospect',
  current_club      text,
  playing_level     text,
  positions         text[],
  dominant_foot     text,
  jersey_size       text,
  school            text,
  graduation_year   int,
  short_term_goals  text,
  long_term_goals   text,
  training_interests text[],
  availability      jsonb,
  medical_notes     text,
  allergies         text,
  medications       text,
  emergency_contact jsonb,
  photo_consent     boolean not null default false,
  medical_treatment_consent boolean not null default false,
  notes             text,
  tags              text[],
  source            text,
  utm               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on athletes (organization_id, status);
create index on athletes (organization_id, date_of_birth);
create index on athletes (household_id);

create or replace function athlete_age(dob date) returns int
language sql immutable as $$ select extract(year from age(dob))::int $$;

create or replace function athlete_age_group(dob date) returns text
language sql stable as $$
  select 'U' || (extract(year from current_date)::int
                 - extract(year from dob)::int
                 + case when extract(month from current_date) >= 8 then 1 else 0 end)
$$;

create table guardian_athletes (
  guardian_id  uuid not null references guardians(id) on delete cascade,
  athlete_id   uuid not null references athletes(id) on delete cascade,
  can_pickup   boolean not null default true,
  can_pay      boolean not null default true,
  can_receive_comms boolean not null default true,
  primary key (guardian_id, athlete_id)
);

create or replace function auth_athlete_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select athlete_id from guardian_athletes ga
    join guardians g on g.id = ga.guardian_id
   where g.user_id = auth.uid()
  union
  select a.id from athletes a where a.user_id = auth.uid()
$$;
