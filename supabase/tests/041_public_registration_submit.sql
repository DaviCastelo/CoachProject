begin;
select plan(2);

-- Reusa setup mínimo do 040
insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1','org-pub','Org Pub')
on conflict (id) do nothing;

insert into forms (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-0000000000ea','00000000-0000-0000-0000-0000000000e1','pub-form','Pub','registration','published')
on conflict (id) do nothing;

insert into form_versions (id, form_id, version, schema, published_at) values
  ('00000000-0000-0000-0000-0000000000eb','00000000-0000-0000-0000-0000000000ea',1,'{"sections":[]}'::jsonb, now())
on conflict (id) do nothing;

-- anon pode executar submit_public_registration (SECURITY DEFINER)
set local role anon;

select lives_ok(
  $$select submit_public_registration(
    '00000000-0000-0000-0000-0000000000eb'::uuid,
    '{"name":"Ana"}'::jsonb,
    '{"first_name":"Ana","last_name":"Silva","date_of_birth":"2015-05-01"}'::jsonb,
    '{"first_name":"Pat","last_name":"Silva","email":"pat@example.com"}'::jsonb
  )$$,
  'anon role can call submit_public_registration'
);

select is(
  (select count(*)::int from form_submissions where organization_id='00000000-0000-0000-0000-0000000000e1'),
  1,
  'submission row created via public RPC'
);

select * from finish();
rollback;
