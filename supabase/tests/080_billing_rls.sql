-- Fase 4 — RLS da cobrança.
--
-- Estas asserções existiam só como transações descartáveis rodadas à mão
-- durante a implementação: provavam que funcionava naquele instante e sumiam.
-- Aqui elas passam a rodar no CI, porque o que este arquivo protege é a
-- pergunta "uma família consegue ver a fatura de outra?" — e a resposta errada
-- não quebra teste nenhum, só vaza dado financeiro em silêncio.

begin;
select plan(15);

-- ---------------------------------------------------------------------------
-- Cenário: duas organizações. Na A, duas famílias com uma fatura cada.
-- ---------------------------------------------------------------------------

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000ba001','org-bill-a','Org Bill A'),
  ('00000000-0000-0000-0000-0000000ba002','org-bill-b','Org Bill B');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-0000000b0001','admin-a@bill.test',   crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000b0002','coach-a@bill.test',   crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000b0003','parent-a1@bill.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000b0004','parent-a2@bill.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000b0005','admin-b@bill.test',   crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000b0001','admin'),
  ('00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000b0002','coach'),
  ('00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000b0003','guardian'),
  ('00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000b0004','guardian'),
  ('00000000-0000-0000-0000-0000000ba002','00000000-0000-0000-0000-0000000b0005','admin');

insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-0000000bd001','00000000-0000-0000-0000-0000000ba001','Silva','silva@bill.test'),
  ('00000000-0000-0000-0000-0000000bd002','00000000-0000-0000-0000-0000000ba001','Souza','souza@bill.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000be001','00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000bd001','Joao','Silva','2015-04-02'),
  ('00000000-0000-0000-0000-0000000be002','00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000bd002','Ana','Souza','2014-09-20');

insert into guardians (id, organization_id, household_id, user_id, first_name, last_name, email, is_primary) values
  ('00000000-0000-0000-0000-0000000bc001','00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000bd001',
   '00000000-0000-0000-0000-0000000b0003','Maria','Silva','parent-a1@bill.test', true),
  ('00000000-0000-0000-0000-0000000bc002','00000000-0000-0000-0000-0000000ba001','00000000-0000-0000-0000-0000000bd002',
   '00000000-0000-0000-0000-0000000b0004','Carla','Souza','parent-a2@bill.test', true);

insert into guardian_athletes (guardian_id, athlete_id) values
  ('00000000-0000-0000-0000-0000000bc001','00000000-0000-0000-0000-0000000be001'),
  ('00000000-0000-0000-0000-0000000bc002','00000000-0000-0000-0000-0000000be002');

insert into invoices (id, organization_id, athlete_id, household_id, number, status,
                      subtotal_cents, discount_cents, total_cents) values
  ('00000000-0000-0000-0000-0000000bf001','00000000-0000-0000-0000-0000000ba001',
   '00000000-0000-0000-0000-0000000be001','00000000-0000-0000-0000-0000000bd001','2026-0001','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000bf002','00000000-0000-0000-0000-0000000ba001',
   '00000000-0000-0000-0000-0000000be002','00000000-0000-0000-0000-0000000bd002','2026-0002','open', 45000, 0, 45000),
  -- Mesmo número de fatura em outra organização: o unique é por org, e um
  -- vazamento entre orgs apareceria aqui como fatura "repetida".
  ('00000000-0000-0000-0000-0000000bf003','00000000-0000-0000-0000-0000000ba002',
   null, null,'2026-0001','open', 10000, 0, 10000);

insert into payments (id, organization_id, invoice_id, provider, method, status,
                      amount_cents, recorded_by, paid_at) values
  ('00000000-0000-0000-0000-0000000b0a01','00000000-0000-0000-0000-0000000ba001',
   '00000000-0000-0000-0000-0000000bf001','offline','venmo','succeeded', 20000,
   '00000000-0000-0000-0000-0000000b0001', now());

insert into refunds (id, organization_id, payment_id, amount_cents, status) values
  ('00000000-0000-0000-0000-0000000b0b01','00000000-0000-0000-0000-0000000ba001',
   '00000000-0000-0000-0000-0000000b0a01', 5000, 'refunded');

-- ---------------------------------------------------------------------------
-- A família Silva
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000b0003","role":"authenticated"}', true);

select is(
  (select count(*)::int from invoices),
  1,
  'Guardian sees exactly one invoice: their own'
);

select is(
  (select count(*)::int from invoices where id = '00000000-0000-0000-0000-0000000bf002'),
  0,
  'Guardian cannot read another household invoice in the same org'
);

select is(
  (select count(*)::int from payments),
  1,
  'Guardian sees the payment on their own invoice'
);

select is(
  (select count(*)::int from refunds),
  1,
  'Guardian sees the refund on their own payment'
);

-- A view é security_invoker: tem que herdar a RLS, não rodar com os poderes
-- do dono. Se alguém trocar isso, esta asserção devolve 3 em vez de 1.
select is(
  (select count(*)::int from invoice_balances),
  1,
  'invoice_balances inherits RLS instead of exposing every org'
);

select is(
  (select balance_cents from invoice_balances where invoice_id = '00000000-0000-0000-0000-0000000bf001'),
  40000,
  'Balance is derived from succeeded payments (60000 - 20000)'
);

-- ---------------------------------------------------------------------------
-- O coach: lê tudo da org, não escreve nada financeiro
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000b0002","role":"authenticated"}', true);

select is(
  (select count(*)::int from invoices),
  2,
  'Coach reads every invoice in their own org'
);

select throws_ok(
  $$insert into invoices (organization_id, number, subtotal_cents, discount_cents, total_cents)
    values ('00000000-0000-0000-0000-0000000ba001','2026-9999', 100, 0, 100)$$,
  '42501',
  null,
  'Coach cannot create an invoice'
);

-- O UPDATE não levanta erro: a RLS filtra a linha e zero linhas são afetadas.
-- Por isso a asserção olha o resultado, não a exceção.
do $$ begin
  update invoices set status = 'paid' where id = '00000000-0000-0000-0000-0000000bf001';
exception when others then null;
end $$;

select is(
  (select status::text from invoices where id = '00000000-0000-0000-0000-0000000bf001'),
  'open',
  'Coach update attempt leaves the invoice status untouched'
);

-- ---------------------------------------------------------------------------
-- Isolamento entre organizações
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000b0005","role":"authenticated"}', true);

select is(
  (select count(*)::int from invoices),
  1,
  'Admin of org B sees only org B invoices'
);

-- ---------------------------------------------------------------------------
-- can_view_invoice chamada direto
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000b0004","role":"authenticated"}', true);

select ok(
  not can_view_invoice('00000000-0000-0000-0000-0000000bf001'),
  'can_view_invoice is false for a guardian of another household'
);

-- ---------------------------------------------------------------------------
-- Infraestrutura: só o servidor toca
-- ---------------------------------------------------------------------------

-- webhook_events e invoice_counters não têm policy nenhuma E tiveram o grant
-- revogado. Quem está logado nem chega na RLS: para na permissão da tabela.
select throws_ok(
  $$select count(*) from webhook_events$$,
  '42501',
  null,
  'Logged-in users cannot read webhook_events'
);

select throws_ok(
  $$select count(*) from invoice_counters$$,
  '42501',
  null,
  'Logged-in users cannot read invoice_counters'
);

-- A trava mais importante do módulo: se authenticated pudesse chamar isto,
-- qualquer pessoa logada marcaria a própria fatura como paga.
select throws_ok(
  $$select apply_stripe_payment(
      '00000000-0000-0000-0000-0000000bf001','pi_forjado','card','succeeded', 60000)$$,
  '42501',
  null,
  'apply_stripe_payment is unreachable for logged-in users'
);

-- O público não lê dado financeiro nem em teoria. Aqui a asserção olha o grant
-- direto em vez de trocar para o papel `anon`: trocar de papel no meio do teste
-- tiraria o acesso do próprio pgTAP às tabelas temporárias do plano.
reset role;

select ok(
  not has_table_privilege('anon', 'invoices', 'select'),
  'Anonymous role has no select grant on invoices'
);

select * from finish();
rollback;
