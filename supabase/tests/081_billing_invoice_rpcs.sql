-- Fase 4 — emissão de fatura a partir da inscrição.
--
-- O que este arquivo protege: a fatura nasce com o preço da opção de programa,
-- nunca duas vezes para a mesma inscrição, numerada por organização, e com a
-- reserva de vaga obedecendo a política que a organização escolheu.
--
-- A idempotência é a asserção mais importante daqui. Dois cliques no botão de
-- "emitir fatura" não podem virar duas cobranças para a mesma família.
--
-- Nota de técnica: cada chamada da RPC fica no seu próprio `do ... perform`,
-- separada da asserção que lê o resultado. Escrever e ler na MESMA instrução
-- não funciona: o snapshot do select é tirado antes de a função rodar, então a
-- linha recém-inserida não estaria visível e o teste falharia sem motivo.

begin;
select plan(15);

-- ---------------------------------------------------------------------------
-- Quatro organizações, uma por política de reserva de vaga
-- ---------------------------------------------------------------------------

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000ca001','org-inv-a','Org Inv A'),  -- sem ajuste: padrão 72h
  ('00000000-0000-0000-0000-0000000ca002','org-inv-b','Org Inv B'),  -- mode none
  ('00000000-0000-0000-0000-0000000ca003','org-inv-c','Org Inv C'),  -- mode unlimited
  ('00000000-0000-0000-0000-0000000ca004','org-inv-d','Org Inv D');  -- timed 24h

insert into org_settings (organization_id, key, value) values
  ('00000000-0000-0000-0000-0000000ca002','payments.reservation','{"mode":"none"}'),
  ('00000000-0000-0000-0000-0000000ca003','payments.reservation','{"mode":"unlimited"}'),
  ('00000000-0000-0000-0000-0000000ca004','payments.reservation','{"mode":"timed","hours":24}');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-0000000c0001','admin@inv.test',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000c0002','parent@inv.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000c0001','admin'),
  ('00000000-0000-0000-0000-0000000ca002','00000000-0000-0000-0000-0000000c0001','admin'),
  ('00000000-0000-0000-0000-0000000ca003','00000000-0000-0000-0000-0000000c0001','admin'),
  ('00000000-0000-0000-0000-0000000ca004','00000000-0000-0000-0000-0000000c0001','admin'),
  -- Responsável: membro da organização, mas não é staff.
  ('00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000c0002','guardian');

insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-0000000cd001','00000000-0000-0000-0000-0000000ca001','Alpha','alpha@inv.test'),
  ('00000000-0000-0000-0000-0000000cd002','00000000-0000-0000-0000-0000000ca002','Beta','beta@inv.test'),
  ('00000000-0000-0000-0000-0000000cd003','00000000-0000-0000-0000-0000000ca003','Gama','gama@inv.test'),
  ('00000000-0000-0000-0000-0000000cd004','00000000-0000-0000-0000-0000000ca004','Delta','delta@inv.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000cd001','A','Alpha','2015-01-01'),
  ('00000000-0000-0000-0000-0000000ce002','00000000-0000-0000-0000-0000000ca002','00000000-0000-0000-0000-0000000cd002','B','Beta','2015-01-01'),
  ('00000000-0000-0000-0000-0000000ce003','00000000-0000-0000-0000-0000000ca003','00000000-0000-0000-0000-0000000cd003','C','Gama','2015-01-01'),
  ('00000000-0000-0000-0000-0000000ce004','00000000-0000-0000-0000-0000000ca004','00000000-0000-0000-0000-0000000cd004','D','Delta','2015-01-01');

insert into programs (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-0000000c7001','00000000-0000-0000-0000-0000000ca001','camp-a','Camp A','camp','published'),
  ('00000000-0000-0000-0000-0000000c7002','00000000-0000-0000-0000-0000000ca002','camp-b','Camp B','camp','published'),
  ('00000000-0000-0000-0000-0000000c7003','00000000-0000-0000-0000-0000000ca003','camp-c','Camp C','camp','published'),
  ('00000000-0000-0000-0000-0000000c7004','00000000-0000-0000-0000-0000000ca004','camp-d','Camp D','camp','published');

insert into program_options (id, organization_id, program_id, name, price_cents) values
  ('00000000-0000-0000-0000-0000000c8001','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000c7001','Full Pass', 60000),
  ('00000000-0000-0000-0000-0000000c8002','00000000-0000-0000-0000-0000000ca002','00000000-0000-0000-0000-0000000c7002','Full Pass', 60000),
  ('00000000-0000-0000-0000-0000000c8003','00000000-0000-0000-0000-0000000ca003','00000000-0000-0000-0000-0000000c7003','Full Pass', 60000),
  ('00000000-0000-0000-0000-0000000c8004','00000000-0000-0000-0000-0000000ca004','00000000-0000-0000-0000-0000000c7004','Full Pass', 60000);

insert into registrations (id, organization_id, athlete_id, program_id, program_option_id) values
  ('00000000-0000-0000-0000-0000000c9001','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000c7001','00000000-0000-0000-0000-0000000c8001'),
  ('00000000-0000-0000-0000-0000000c9002','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000c7001','00000000-0000-0000-0000-0000000c8001'),
  ('00000000-0000-0000-0000-0000000c9004','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000c7001','00000000-0000-0000-0000-0000000c8001'),
  ('00000000-0000-0000-0000-0000000c9005','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000c7001','00000000-0000-0000-0000-0000000c8001'),
  ('00000000-0000-0000-0000-0000000c9011','00000000-0000-0000-0000-0000000ca002','00000000-0000-0000-0000-0000000ce002','00000000-0000-0000-0000-0000000c7002','00000000-0000-0000-0000-0000000c8002'),
  ('00000000-0000-0000-0000-0000000c9012','00000000-0000-0000-0000-0000000ca003','00000000-0000-0000-0000-0000000ce003','00000000-0000-0000-0000-0000000c7003','00000000-0000-0000-0000-0000000c8003'),
  ('00000000-0000-0000-0000-0000000c9013','00000000-0000-0000-0000-0000000ca004','00000000-0000-0000-0000-0000000ce004','00000000-0000-0000-0000-0000000c7004','00000000-0000-0000-0000-0000000c8004');

-- Inscrição sem opção de programa: existe de verdade quando alguém cria a
-- inscrição na mão, fora do formulário.
insert into registrations (id, organization_id, athlete_id, program_id) values
  ('00000000-0000-0000-0000-0000000c9003','00000000-0000-0000-0000-0000000ca001','00000000-0000-0000-0000-0000000ce001','00000000-0000-0000-0000-0000000c7001');

-- ---------------------------------------------------------------------------
-- O admin emite
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000c0001","role":"authenticated"}', true);

do $$ begin perform create_invoice_for_registration('00000000-0000-0000-0000-0000000c9001'); end $$;

select is(
  (select i.total_cents from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-0000000c9001'),
  60000,
  'Invoice total comes from the program option price'
);

select is(
  (select i.status::text from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-0000000c9001'),
  'open',
  'A freshly issued invoice is open, not draft: the family can already pay'
);

select is(
  (select i.number from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-0000000c9001'),
  extract(year from now())::int || '-0001',
  'Invoice number is the year plus a zero-padded per-org sequence'
);

-- Padrão de 72 horas quando a organização não configurou nada.
select ok(
  (select reserved_until from registrations where id = '00000000-0000-0000-0000-0000000c9001')
    between now() + interval '71 hours' and now() + interval '73 hours',
  'Without a setting, the slot is held for the default 72 hours'
);

-- A trava contra cobrança dupla: o segundo clique devolve a MESMA fatura.
select is(
  (select create_invoice_for_registration('00000000-0000-0000-0000-0000000c9001')),
  (select invoice_id from registrations where id = '00000000-0000-0000-0000-0000000c9001'),
  'Calling it twice returns the invoice that already exists'
);

select is(
  (select count(*)::int from invoices where organization_id = '00000000-0000-0000-0000-0000000ca001'),
  1,
  'The second call creates no extra invoice'
);

do $$ begin
  perform create_invoice_for_registration('00000000-0000-0000-0000-0000000c9002', 10000, 'early bird');
end $$;

select is(
  (select i.number from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-0000000c9002'),
  extract(year from now())::int || '-0002',
  'The sequence advances for the next invoice in the same org'
);

select is(
  (select i.total_cents from invoices i
     join registrations r on r.invoice_id = i.id
    where r.id = '00000000-0000-0000-0000-0000000c9002'),
  50000,
  'Discount is subtracted from the subtotal'
);

-- ---------------------------------------------------------------------------
-- O que a função recusa
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select create_invoice_for_registration('00000000-0000-0000-0000-0000000c9004', 70000)$$,
  'P0001',
  'desconto inválido: 70000 sobre preço de 60000',
  'A discount larger than the price is rejected'
);

select throws_ok(
  $$select create_invoice_for_registration('00000000-0000-0000-0000-0000000c9003')$$,
  'P0001',
  'inscrição 00000000-0000-0000-0000-0000000c9003 não tem opção de programa, não há preço para faturar',
  'A registration with no program option has no price to bill'
);

-- ---------------------------------------------------------------------------
-- Política de reserva por organização
-- ---------------------------------------------------------------------------

do $$ begin
  perform create_invoice_for_registration('00000000-0000-0000-0000-0000000c9011');
  perform create_invoice_for_registration('00000000-0000-0000-0000-0000000c9012');
  perform create_invoice_for_registration('00000000-0000-0000-0000-0000000c9013');
end $$;

select ok(
  (select reserved_until from registrations where id = '00000000-0000-0000-0000-0000000c9011') is null,
  'mode "none" issues the invoice without holding the slot'
);

select ok(
  (select reserved_until from registrations where id = '00000000-0000-0000-0000-0000000c9012') is null,
  'mode "unlimited" stores no deadline: the hold ends only by hand'
);

select ok(
  (select reserved_until from registrations where id = '00000000-0000-0000-0000-0000000c9013')
    between now() + interval '23 hours' and now() + interval '25 hours',
  'mode "timed" with 24 hours is honoured instead of the default'
);

-- A numeração é por organização: a Org B também começa no 0001.
select is(
  (select number from invoices where organization_id = '00000000-0000-0000-0000-0000000ca002'),
  extract(year from now())::int || '-0001',
  'Numbering restarts per organization, it is not global'
);

-- ---------------------------------------------------------------------------
-- Quem não é staff não fatura
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000c0002","role":"authenticated"}', true);

select throws_ok(
  $$select create_invoice_for_registration('00000000-0000-0000-0000-0000000c9005')$$,
  'P0001',
  'sem permissão para faturar nesta organização',
  'A guardian cannot issue an invoice, even for their own athlete'
);

select * from finish();
rollback;
