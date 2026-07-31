begin;
select plan(4);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000d1','org-d','Org D');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000020', 'staff@d.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000021', 'owner@d.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into profiles (id, email) values
  ('00000000-0000-0000-0000-000000000020', 'staff@d.com'),
  ('00000000-0000-0000-0000-000000000021', 'owner@d.com');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000020','staff'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000021','owner');

insert into athletes (organization_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000d1', 'Athlete', 'One', '2012-06-01'),
  ('00000000-0000-0000-0000-0000000000d1', 'Athlete', 'Two', '2011-06-01');

insert into locations (organization_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', 'Field A'),
  ('00000000-0000-0000-0000-0000000000d1', 'Field B');

-- Staff reads all athletes and locations
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000020","role":"authenticated"}', true);

select is( (select count(*)::int from athletes), 2,
  'Staff reads all athletes in org' );

select is( (select count(*)::int from locations), 2,
  'Staff reads all locations in org' );

-- Staff cannot write org_settings
select throws_ok(
  $$insert into org_settings (organization_id, key, value) values ('00000000-0000-0000-0000-0000000000d1', 'module.library', 'false')$$,
  '42501',
  null,
  'Staff cannot write org_settings'
);

-- Owner can write org_settings
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000021","role":"authenticated"}', true);

select lives_ok(
  $$insert into org_settings (organization_id, key, value) values ('00000000-0000-0000-0000-0000000000d1', 'module.library', 'false')$$,
  'Owner can write org_settings'
);

select * from finish();
rollback;
