begin;
select plan(4);

-- Setup: one org, staff user, guardian user, two athletes
insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000c1','org-c','Org C');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000010', 'guardian@c.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000011', 'staff@c.com', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into profiles (id, email) values
  ('00000000-0000-0000-0000-000000000010', 'guardian@c.com'),
  ('00000000-0000-0000-0000-000000000011', 'staff@c.com');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000010','guardian'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000011','coach');

insert into households (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Smith Family');

insert into guardians (id, organization_id, household_id, user_id, first_name, last_name, email) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000010', 'John', 'Smith', 'guardian@c.com');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Emma', 'Smith', '2014-03-15'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', null, 'Other', 'Kid', '2013-01-01');

insert into guardian_athletes (guardian_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1');

-- Guardian sees only linked athlete
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);

select is( (select count(*)::int from athletes), 1,
  'Guardian reads only linked athlete' );

select is( (select first_name from athletes limit 1), 'Emma',
  'Guardian sees correct athlete' );

-- Guardian cannot read other memberships
select is( (select count(*)::int from memberships where user_id != '00000000-0000-0000-0000-000000000010'), 0,
  'Guardian cannot read other memberships' );

-- Guardian cannot write org_settings
select throws_ok(
  $$insert into org_settings (organization_id, key, value) values ('00000000-0000-0000-0000-0000000000c1', 'test', 'false')$$,
  '42501',
  null,
  'Guardian cannot write org_settings'
);

select * from finish();
rollback;
