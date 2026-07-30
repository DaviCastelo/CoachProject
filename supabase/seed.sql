-- CA Tempo seed data (local/staging only — never run in production)

-- Organization
insert into organizations (id, slug, name, timezone, locale, contact_email)
values (
  'e45be439-217d-467e-a4fa-a9001738b83b',
  'ca-tempo',
  'CA Tempo Training',
  'America/New_York',
  'en-US',
  'info@catempotraining.com'
) on conflict (id) do nothing;

-- Test users (auth.users)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role, raw_user_meta_data)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    'arthur@catempo.test',
    crypt('testpassword123', gen_salt('bf')),
    now(), now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '{"full_name": "Arthur Coach"}'::jsonb
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'coach@catempo.test',
    crypt('testpassword123', gen_salt('bf')),
    now(), now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '{"full_name": "Carlos Assistant"}'::jsonb
  ),
  (
    'g3333333-3333-3333-3333-333333333333',
    'guardian@catempo.test',
    crypt('testpassword123', gen_salt('bf')),
    now(), now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '{"full_name": "Maria Guardian"}'::jsonb
  )
on conflict (id) do nothing;

-- Profiles (trigger may create these; ensure they exist)
insert into profiles (id, email, full_name) values
  ('a1111111-1111-1111-1111-111111111111', 'arthur@catempo.test', 'Arthur Coach'),
  ('c2222222-2222-2222-2222-222222222222', 'coach@catempo.test', 'Carlos Assistant'),
  ('g3333333-3333-3333-3333-333333333333', 'guardian@catempo.test', 'Maria Guardian')
on conflict (id) do update set full_name = excluded.full_name;

-- Memberships
insert into memberships (organization_id, user_id, role, status, accepted_at) values
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'a1111111-1111-1111-1111-111111111111', 'owner', 'active', now()),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'c2222222-2222-2222-2222-222222222222', 'coach', 'active', now()),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'g3333333-3333-3333-3333-333333333333', 'guardian', 'active', now())
on conflict do nothing;

-- Household
insert into households (id, organization_id, name, primary_email) values
  ('h4444444-4444-4444-4444-444444444444', 'e45be439-217d-467e-a4fa-a9001738b83b', 'Silva Family', 'guardian@catempo.test')
on conflict (id) do nothing;

-- Guardian
insert into guardians (id, organization_id, household_id, user_id, first_name, last_name, email, is_primary) values
  ('gd555555-5555-5555-5555-555555555555', 'e45be439-217d-467e-a4fa-a9001738b83b', 'h4444444-4444-4444-4444-444444444444', 'g3333333-3333-3333-3333-333333333333', 'Maria', 'Silva', 'guardian@catempo.test', true)
on conflict (id) do nothing;

-- Athletes
insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth, status) values
  ('at666666-6666-6666-6666-666666666661', 'e45be439-217d-467e-a4fa-a9001738b83b', 'h4444444-4444-4444-4444-444444444444', 'Lucas', 'Silva', '2015-05-01', 'active'),
  ('at666666-6666-6666-6666-666666666662', 'e45be439-217d-467e-a4fa-a9001738b83b', 'h4444444-4444-4444-4444-444444444444', 'Sofia', 'Silva', '2017-08-20', 'active')
on conflict (id) do nothing;

-- Guardian-Athlete links
insert into guardian_athletes (guardian_id, athlete_id) values
  ('gd555555-5555-5555-5555-555555555555', 'at666666-6666-6666-6666-666666666661'),
  ('gd555555-5555-5555-5555-555555555555', 'at666666-6666-6666-6666-666666666662')
on conflict do nothing;

-- Locations
insert into locations (organization_id, name, city, state, is_active) values
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'Main Field', 'Miami', 'FL', true),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'Training Center', 'Miami', 'FL', true);
