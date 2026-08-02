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
    crypt('Admin123', gen_salt('bf')),
    now(), now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '{"full_name": "Arthur Coach"}'::jsonb
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'coach@catempo.test',
    crypt('Admin123', gen_salt('bf')),
    now(), now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '{"full_name": "Carlos Assistant"}'::jsonb
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    'guardian@catempo.test',
    crypt('Admin123', gen_salt('bf')),
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
  ('f3333333-3333-3333-3333-333333333333', 'guardian@catempo.test', 'Maria Guardian')
on conflict (id) do update set full_name = excluded.full_name;

-- Memberships
insert into memberships (organization_id, user_id, role, status, accepted_at) values
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'a1111111-1111-1111-1111-111111111111', 'owner', 'active', now()),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'c2222222-2222-2222-2222-222222222222', 'coach', 'active', now()),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'f3333333-3333-3333-3333-333333333333', 'guardian', 'active', now())
on conflict do nothing;

-- Household
insert into households (id, organization_id, name, primary_email) values
  ('b4444444-4444-4444-4444-444444444444', 'e45be439-217d-467e-a4fa-a9001738b83b', 'Silva Family', 'guardian@catempo.test')
on conflict (id) do nothing;

-- Guardian
insert into guardians (id, organization_id, household_id, user_id, first_name, last_name, email, is_primary) values
  ('d5555555-5555-5555-5555-555555555555', 'e45be439-217d-467e-a4fa-a9001738b83b', 'b4444444-4444-4444-4444-444444444444', 'f3333333-3333-3333-3333-333333333333', 'Maria', 'Silva', 'guardian@catempo.test', true)
on conflict (id) do nothing;

-- Athletes
insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth, status) values
  ('a6666666-6666-6666-6666-666666666661', 'e45be439-217d-467e-a4fa-a9001738b83b', 'b4444444-4444-4444-4444-444444444444', 'Lucas', 'Silva', '2015-05-01', 'active'),
  ('a6666666-6666-6666-6666-666666666662', 'e45be439-217d-467e-a4fa-a9001738b83b', 'b4444444-4444-4444-4444-444444444444', 'Sofia', 'Silva', '2017-08-20', 'active')
on conflict (id) do nothing;

-- Guardian-Athlete links
insert into guardian_athletes (guardian_id, athlete_id) values
  ('d5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666661'),
  ('d5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666662')
on conflict do nothing;

-- Locations
insert into locations (organization_id, name, city, state, is_active) values
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'Main Field', 'Miami', 'FL', true),
  ('e45be439-217d-467e-a4fa-a9001738b83b', 'Training Center', 'Miami', 'FL', true);

-- Catálogo público de demonstração (Fase 2): formulário, programa, opções e waiver
insert into forms (id, organization_id, slug, name, description, type, status, requires_waiver, success_message) values
  ('11111111-0000-0000-0000-000000000001', 'e45be439-217d-467e-a4fa-a9001738b83b', 'summer-camp-2026',
   'CA Tempo Summer Camp 2026', 'Register your athlete for the CA Tempo Summer Camp.', 'registration', 'published', true,
   'Thanks! Your camp registration was received. We will reach out with payment options.')
on conflict (id) do nothing;

insert into form_versions (id, form_id, version, schema, published_at) values
  ('11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 1, '{
    "sections": [
      {"id":"athlete","title":"Athlete Information","fields":[
        {"id":"first_name","type":"text","label":"Athletes First Name","required":true,"mapsTo":"athlete.first_name"},
        {"id":"last_name","type":"text","label":"Athletes Last Name","required":true,"mapsTo":"athlete.last_name"},
        {"id":"dob","type":"dob","label":"Birth Date","required":true,"mapsTo":"athlete.date_of_birth","validation":{"minYear":2013,"maxYear":2018}},
        {"id":"gender","type":"select","label":"Gender","options":["Male","Female"],"mapsTo":"athlete.gender"},
        {"id":"current_club","type":"text","label":"Current Club","mapsTo":"athlete.current_club"},
        {"id":"level","type":"select","label":"Playing Level","options":["GOLD","PREMIER","ECNL","PRE-ECNL","ECNLRL","PRE-ECNLRL","MLS","GA"],"mapsTo":"athlete.playing_level"},
        {"id":"shirt","type":"select","label":"Shirt Size","options":["Youth S","Youth M","Youth L","Youth XL","Adult S","Adult M"],"mapsTo":"athlete.jersey_size"}
      ]},
      {"id":"guardian","title":"Parent / Guardian","fields":[
        {"id":"g_first","type":"text","label":"Guardian First Name","required":true,"mapsTo":"guardian.first_name"},
        {"id":"g_last","type":"text","label":"Guardian Last Name","required":true,"mapsTo":"guardian.last_name"},
        {"id":"g_email","type":"email","label":"Email","required":true,"mapsTo":"guardian.email"},
        {"id":"g_phone","type":"phone","label":"Phone","mapsTo":"guardian.phone"},
        {"id":"relationship","type":"select","label":"Relationship","options":["Mother","Father","Guardian"],"mapsTo":"guardian.relationship"}
      ]}
    ]
  }'::jsonb, now())
on conflict (id) do nothing;

insert into waiver_templates (id, organization_id, name, version, body_markdown, effective_from, is_active) values
  ('11111111-0000-0000-0000-000000000003', 'e45be439-217d-467e-a4fa-a9001738b83b', 'CA Tempo Liability Waiver', 1,
   $w$# CA Tempo Training — Liability Waiver and Release

I, the parent/legal guardian of the registered athlete, acknowledge that participation in soccer training, camps and related activities involves inherent risks, including physical injury.

In consideration of my child's participation, I release, waive and discharge CA Tempo Training, its coaches and staff from any and all liability for injuries or damages arising from participation, except where caused by gross negligence.

I confirm that my child is physically able to participate and I authorize CA Tempo Training to seek emergency medical treatment if needed. I have read and understood this waiver and agree to its terms.$w$,
   current_date, true)
on conflict (id) do nothing;

insert into programs (id, organization_id, slug, name, type, status, form_id, waiver_template_id, min_birth_year, max_birth_year, capacity, description) values
  ('11111111-0000-0000-0000-000000000004', 'e45be439-217d-467e-a4fa-a9001738b83b', 'summer-camp-2026',
   'CA Tempo Summer Camp 2026', 'camp', 'published',
   '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003',
   2013, 2018, 24, 'Two weeks of high-level training. Boys and girls born 2013-2018.')
on conflict (id) do nothing;

insert into program_options (id, organization_id, program_id, name, description, price_cents, sort_order) values
  ('11111111-0000-0000-0000-000000000005', 'e45be439-217d-467e-a4fa-a9001738b83b', '11111111-0000-0000-0000-000000000004', 'Week 1 Pass', '4 days of training + Camp T-Shirt', 35000, 1),
  ('11111111-0000-0000-0000-000000000006', 'e45be439-217d-467e-a4fa-a9001738b83b', '11111111-0000-0000-0000-000000000004', 'Full Camp Pass', '8 days of training + Camp T-Shirt', 60000, 2)
on conflict (id) do nothing;
