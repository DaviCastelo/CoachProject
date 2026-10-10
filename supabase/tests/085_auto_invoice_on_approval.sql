-- Fase 4 — emissão automática de fatura na aprovação.
--
-- Esta migration deu função ao `forms.requires_payment`, que era um checkbox
-- sem nada atrás. O risco de ligar foi criar um caminho em que a aprovação da
-- inscrição passa a depender de a fatura dar certo.
--
-- A asserção central do arquivo é justamente a inversa: inscrição sem preço
-- APROVA do mesmo jeito, entra no grupo e ativa o atleta. A aprovação é a
-- operação principal; a fatura é consequência. Se alguém trocar o `return`
-- quieto por um `raise`, o atleta deixa de entrar no grupo por causa de um
-- preço faltando — e é este teste que avisa.

begin;
select plan(13);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-000000002a01','org-appr-a','Org Appr A'),
  ('00000000-0000-0000-0000-000000002a02','org-appr-b','Org Appr B');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000002b01','admin@appr.test',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000002b02','parent@appr.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002b01','admin'),
  ('00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002b02','guardian');

insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-000000002c01','00000000-0000-0000-0000-000000002a01','Appr','appr@appr.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-000000002d01','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Um','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d02','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Dois','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d03','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Tres','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d04','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Quatro','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d05','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Cinco','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d06','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Seis','Appr','2015-01-01'),
  ('00000000-0000-0000-0000-000000002d07','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002c01','Sete','Appr','2015-01-01');

insert into programs (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002a01','camp-appr','Camp Appr','camp','published');

insert into program_options (id, organization_id, program_id, name, price_cents) values
  ('00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002e01','Full Pass', 60000);

insert into groups (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000002501','00000000-0000-0000-0000-000000002a01','U10'),
  ('00000000-0000-0000-0000-000000002502','00000000-0000-0000-0000-000000002a02','Outra Org');

-- Dois formulários: um que cobra, um que não. É o checkbox que agora decide.
insert into forms (id, organization_id, slug, name, type, status, requires_payment) values
  ('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000002a01','pago','Inscricao Paga','registration','published', true),
  ('00000000-0000-0000-0000-000000002102','00000000-0000-0000-0000-000000002a01','free','Inscricao Free','registration','published', false);

insert into form_versions (id, form_id, version, schema, published_at) values
  ('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002101',1,'{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-000000002102',1,'{}'::jsonb, now());

insert into form_submissions (id, organization_id, form_version_id, athlete_id, data, status) values
  ('00000000-0000-0000-0000-000000002301','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002d01','{}'::jsonb,'processed'),
  ('00000000-0000-0000-0000-000000002302','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-000000002d02','{}'::jsonb,'processed'),
  ('00000000-0000-0000-0000-000000002303','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002d03','{}'::jsonb,'processed'),
  ('00000000-0000-0000-0000-000000002305','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002d05','{}'::jsonb,'processed'),
  ('00000000-0000-0000-0000-000000002306','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002d06','{}'::jsonb,'processed'),
  ('00000000-0000-0000-0000-000000002307','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002d07','{}'::jsonb,'processed');

insert into invoices (id, organization_id, athlete_id, household_id, number, status,
                      subtotal_cents, discount_cents, total_cents) values
  ('00000000-0000-0000-0000-000000002601','00000000-0000-0000-0000-000000002a01',
   '00000000-0000-0000-0000-000000002d05','00000000-0000-0000-0000-000000002c01','2026-9001','open', 60000, 0, 60000);

insert into registrations (id, organization_id, athlete_id, program_id, program_option_id, submission_id, invoice_id) values
  -- Cobra e tem preço: emite.
  ('00000000-0000-0000-0000-000000002401','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d01','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002301', null),
  -- Formulário gratuito: não emite.
  ('00000000-0000-0000-0000-000000002402','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d02','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002302', null),
  -- Já faturada: não emite de novo.
  ('00000000-0000-0000-0000-000000002405','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d05','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002305','00000000-0000-0000-0000-000000002601'),
  ('00000000-0000-0000-0000-000000002406','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d06','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002306', null),
  ('00000000-0000-0000-0000-000000002407','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d07','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01','00000000-0000-0000-0000-000000002307', null);

-- Cobra MAS não tem opção de programa escolhida: o caso do guard.
insert into registrations (id, organization_id, athlete_id, program_id, submission_id) values
  ('00000000-0000-0000-0000-000000002403','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d03','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002303');

-- Criada fora de formulário: não há `requires_payment` para consultar.
insert into registrations (id, organization_id, athlete_id, program_id, program_option_id) values
  ('00000000-0000-0000-0000-000000002404','00000000-0000-0000-0000-000000002a01','00000000-0000-0000-0000-000000002d04','00000000-0000-0000-0000-000000002e01','00000000-0000-0000-0000-000000002f01');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002b01","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Formulário que cobra: a fatura sai junto com a aprovação
-- ---------------------------------------------------------------------------

do $$ begin
  perform approve_registration_with_groups(
    '00000000-0000-0000-0000-000000002401', array['00000000-0000-0000-0000-000000002501']::uuid[]);
end $$;

select ok(
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-000000002401') is not null,
  'Approving a paid-form registration issues the invoice in the same breath'
);

select is(
  (select i.total_cents from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-000000002401'),
  60000,
  'The auto-issued invoice carries the program option price'
);

select is(
  (select status::text from registrations where id = '00000000-0000-0000-0000-000000002401'),
  'approved',
  'The registration itself is approved'
);

select is(
  (select status::text from athletes where id = '00000000-0000-0000-0000-000000002d01'),
  'active',
  'An accepted registration activates the athlete'
);

select is(
  (select count(*)::int from group_members
    where group_id = '00000000-0000-0000-0000-000000002501'
      and athlete_id = '00000000-0000-0000-0000-000000002d01'),
  1,
  'The athlete joins the group given at approval'
);

-- ---------------------------------------------------------------------------
-- Formulário gratuito: nada de fatura
-- ---------------------------------------------------------------------------

do $$ begin
  perform approve_registration_with_groups('00000000-0000-0000-0000-000000002402');
end $$;

select ok(
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-000000002402') is null,
  'A free form approves without issuing anything'
);

-- ---------------------------------------------------------------------------
-- O guard: sem preço, a aprovação continua valendo
-- ---------------------------------------------------------------------------

do $$ begin
  perform approve_registration_with_groups(
    '00000000-0000-0000-0000-000000002403', array['00000000-0000-0000-0000-000000002501']::uuid[]);
end $$;

select is(
  (select status::text from registrations where id = '00000000-0000-0000-0000-000000002403'),
  'approved',
  'A missing price does NOT abort the approval'
);

select is(
  (select count(*)::int from group_members
    where group_id = '00000000-0000-0000-0000-000000002501'
      and athlete_id = '00000000-0000-0000-0000-000000002d03'),
  1,
  'The athlete still joins the group when there is no price to bill'
);

select ok(
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-000000002403') is null,
  'No invoice is issued, so the registration shows up in the unbilled queue'
);

-- ---------------------------------------------------------------------------
-- Inscrição criada fora de formulário
-- ---------------------------------------------------------------------------

do $$ begin
  perform approve_registration_with_groups('00000000-0000-0000-0000-000000002404');
end $$;

select ok(
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-000000002404') is null,
  'With no form behind it there is no requires_payment to honour'
);

-- ---------------------------------------------------------------------------
-- Já faturada
-- ---------------------------------------------------------------------------

do $$ begin
  perform approve_registration_with_groups('00000000-0000-0000-0000-000000002405');
end $$;

select is(
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-000000002405'),
  '00000000-0000-0000-0000-000000002601'::uuid,
  'An already billed registration keeps its invoice instead of gaining a second'
);

-- ---------------------------------------------------------------------------
-- Grupo de outra organização
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select approve_registration_with_groups(
      '00000000-0000-0000-0000-000000002406',
      array['00000000-0000-0000-0000-000000002502']::uuid[])$$,
  'P0001',
  'group_not_in_org',
  'A group from another organization is refused'
);

-- ---------------------------------------------------------------------------
-- Quem aprova
-- ---------------------------------------------------------------------------

-- Emissão automática não afrouxou quem pode aprovar: continua owner/admin.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000002b02","role":"authenticated"}', true);

select throws_ok(
  $$select approve_registration_with_groups('00000000-0000-0000-0000-000000002407')$$,
  'P0001',
  'forbidden',
  'A guardian cannot approve a registration'
);

select * from finish();
rollback;
