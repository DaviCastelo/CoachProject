begin;
select plan(2);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000f1','org-link','Org Link')
on conflict (id) do nothing;

insert into forms (id, organization_id, slug, name, type, status, program_id) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1','form-a','Form A','registration','published', null),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f1','form-b','Form B','registration','published', null)
on conflict (id) do nothing;

insert into programs (id, organization_id, slug, name, type, status, form_id) values
  ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000f1','camp-link','Camp','camp','published',
   '00000000-0000-0000-0000-0000000000f2')
on conflict (id) do nothing;

update forms
   set program_id = '00000000-0000-0000-0000-0000000000f4'
 where id = '00000000-0000-0000-0000-0000000000f3';

insert into form_versions (id, form_id, version, schema, published_at) values
  ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f3',1,'{"sections":[]}'::jsonb, now())
on conflict (id) do nothing;

select is(
  (
    select p.id::text
      from forms f
      join programs p on p.id = f.program_id
     where f.id = '00000000-0000-0000-0000-0000000000f3'
       and p.status = 'published'
  ),
  '00000000-0000-0000-0000-0000000000f4',
  'form B is linked to the published program before submit'
);

do $$
begin
  perform set_config(
    'test.reg_id',
    submit_public_registration(
      '00000000-0000-0000-0000-0000000000f5'::uuid,
      '{"name":"Ana"}'::jsonb,
      '{"first_name":"Ana","last_name":"Link","date_of_birth":"2015-05-01"}'::jsonb,
      '{"first_name":"Pat","last_name":"Link","email":"pat-link@example.com"}'::jsonb
    )::text,
    true
  );
end $$;

select is(
  (
    select r.program_id::text
      from registrations r
     where r.id = current_setting('test.reg_id')::uuid
  ),
  '00000000-0000-0000-0000-0000000000f4',
  'second form charges the program linked on the form, not the public form pointer'
);

select * from finish();
rollback;
