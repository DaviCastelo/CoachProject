begin;
select plan(5);

-- Setup: uma org, um formulário publicado + versão, duas submissões cruas
insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000d1','org-p','Org P');

insert into forms (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000d1','camp','Camp','registration','published');

insert into form_versions (id, form_id, version, schema, published_at) values
  ('00000000-0000-0000-0000-0000000000fb','00000000-0000-0000-0000-0000000000fa',1,'{"sections":[]}'::jsonb, now());

insert into form_submissions (id, organization_id, form_version_id, data, status) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000fb','{}'::jsonb,'received'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000fb','{}'::jsonb,'received');

-- Primeira submissão → cria atleta/guardian/household/registration
do $$ begin perform process_registration_submission(
  '00000000-0000-0000-0000-0000000000b1',
  '{"first_name":"Test","last_name":"Camper","date_of_birth":"2015-05-01"}'::jsonb,
  '{"first_name":"Pat","last_name":"Camper","email":"parent@example.com"}'::jsonb,
  '{}'::jsonb); end $$;

select is( (select count(*)::int from athletes where organization_id='00000000-0000-0000-0000-0000000000d1'), 1,
  'first submission creates exactly one athlete' );

-- Segunda submissão do MESMO atleta (case/whitespace diferentes) → dedupe
do $$ begin perform process_registration_submission(
  '00000000-0000-0000-0000-0000000000b2',
  '{"first_name":"test","last_name":"CAMPER","date_of_birth":"2015-05-01"}'::jsonb,
  '{"first_name":"Pat","last_name":"Camper","email":"Parent@Example.com"}'::jsonb,
  '{}'::jsonb); end $$;

select is( (select count(*)::int from athletes where organization_id='00000000-0000-0000-0000-0000000000d1'), 1,
  'duplicate athlete (name+dob) is deduped, not duplicated' );

select is( (select count(*)::int from guardians where organization_id='00000000-0000-0000-0000-0000000000d1'), 1,
  'guardian matched by email is not duplicated' );

select is( (select count(*)::int from registrations where organization_id='00000000-0000-0000-0000-0000000000d1'), 2,
  'each submission yields its own registration' );

select is( (select count(*)::int from form_submissions
             where organization_id='00000000-0000-0000-0000-0000000000d1' and status='processed'), 2,
  'both submissions are marked processed' );

select * from finish();
rollback;
