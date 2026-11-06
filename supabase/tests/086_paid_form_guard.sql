-- Formulário pago sem preço disponível recusa a inscrição.
--
-- O caso real: programa em rascunho, inscrição entrando sem preço, aprovação
-- sem fatura e nenhum aviso. Sem esta trava o erro só aparecia dias depois.

begin;
select plan(6);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-000000003a01','org-guard','Org Guard');

insert into programs (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-000000003e01','00000000-0000-0000-0000-000000003a01','rascunho','Rascunho','camp','draft'),
  ('00000000-0000-0000-0000-000000003e02','00000000-0000-0000-0000-000000003a01','publicado','Publicado','camp','published');

insert into program_options (id, organization_id, program_id, name, price_cents) values
  ('00000000-0000-0000-0000-000000003f01','00000000-0000-0000-0000-000000003a01','00000000-0000-0000-0000-000000003e01','Passe Rascunho', 100),
  ('00000000-0000-0000-0000-000000003f02','00000000-0000-0000-0000-000000003a01','00000000-0000-0000-0000-000000003e02','Passe Publicado', 100);

insert into forms (id, organization_id, slug, name, type, status, requires_payment, program_id) values
  ('00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003a01','pago-rascunho','Pago Rascunho','registration','published', true, '00000000-0000-0000-0000-000000003e01'),
  ('00000000-0000-0000-0000-000000003102','00000000-0000-0000-0000-000000003a01','pago-ok','Pago Ok','registration','published', true, '00000000-0000-0000-0000-000000003e02'),
  ('00000000-0000-0000-0000-000000003103','00000000-0000-0000-0000-000000003a01','gratis','Gratis','registration','published', false, null);

insert into form_versions (id, form_id, version, schema, published_at) values
  ('00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003101',1,'{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000003202','00000000-0000-0000-0000-000000003102',1,'{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000003203','00000000-0000-0000-0000-000000003103',1,'{}'::jsonb, now());

select throws_ok(
  $$ select submit_public_registration('00000000-0000-0000-0000-000000003201'::uuid, '{}'::jsonb,
       '{"first_name":"A","last_name":"B","date_of_birth":"2015-01-01"}'::jsonb,
       '{"email":"a@guard.test"}'::jsonb, '{}'::jsonb,
       '00000000-0000-0000-0000-000000003f01'::uuid) $$,
  'paid_form_not_ready',
  'programa em rascunho: a opção existe, mas o formulário pago recusa'
);

select throws_ok(
  $$ select submit_public_registration('00000000-0000-0000-0000-000000003202'::uuid, '{}'::jsonb,
       '{"first_name":"A","last_name":"B","date_of_birth":"2015-01-01"}'::jsonb,
       '{"email":"a@guard.test"}'::jsonb) $$,
  'paid_form_not_ready',
  'programa publicado, mas nenhuma opção escolhida: recusa'
);

select is(
  (select count(*)::int from form_submissions s
     join form_versions v on v.id = s.form_version_id
    where v.form_id in ('00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003102')),
  0,
  'recusa não deixa submissão pela metade'
);

select lives_ok(
  $$ select submit_public_registration('00000000-0000-0000-0000-000000003202'::uuid, '{}'::jsonb,
       '{"first_name":"Ok","last_name":"Pago","date_of_birth":"2015-01-01"}'::jsonb,
       '{"email":"ok@guard.test","first_name":"R","last_name":"Pago"}'::jsonb, '{}'::jsonb,
       '00000000-0000-0000-0000-000000003f02'::uuid) $$,
  'programa publicado com opção escolhida: entra'
);

select is(
  (select r.program_option_id from registrations r
    where r.organization_id = '00000000-0000-0000-0000-000000003a01' limit 1),
  '00000000-0000-0000-0000-000000003f02'::uuid,
  'a inscrição guarda o preço escolhido'
);

select lives_ok(
  $$ select submit_public_registration('00000000-0000-0000-0000-000000003203'::uuid, '{}'::jsonb,
       '{"first_name":"Ok","last_name":"Gratis","date_of_birth":"2015-01-01"}'::jsonb,
       '{"email":"free@guard.test","first_name":"R","last_name":"Gratis"}'::jsonb) $$,
  'formulário gratuito continua sem exigir preço'
);

select * from finish();
rollback;
