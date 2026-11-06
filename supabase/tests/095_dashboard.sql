-- Painel: dinheiro com valor exato, e só para quem pode ver.
--
-- Um número errado num painel de dono de negócio é pior que nenhum número:
-- ele vira decisão. Por isso os valores aqui são exatos e cada armadilha tem
-- um pagamento montado só para cair nela: reembolso acumulado, pagamento
-- ainda compensando, pagamento falho e pagamento feito de noite em Nova York.

begin;
select plan(25);

insert into organizations (id, slug, name, timezone) values
  ('00000000-0000-0000-0000-000000005a01','dash-a','Dash A','America/New_York'),
  ('00000000-0000-0000-0000-000000005a02','dash-b','Dash B','America/New_York');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000005b01','admin@dash.test', crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000005b02','coach@dash.test', crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000005b03','other@dash.test', crypt('p', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005b01','admin'),
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005b02','coach'),
  ('00000000-0000-0000-0000-000000005a02','00000000-0000-0000-0000-000000005b03','admin');

insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-000000005c01','00000000-0000-0000-0000-000000005a01','Casa','casa@dash.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth, status) values
  ('00000000-0000-0000-0000-000000005d01','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005c01','Ana','Dash','2014-03-01','active'),
  ('00000000-0000-0000-0000-000000005d02','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005c01','Bia','Dash','2015-03-01','active'),
  ('00000000-0000-0000-0000-000000005d03','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005c01','Cau','Dash','2015-03-01','inactive');

insert into programs (id, organization_id, slug, name, type, status, capacity) values
  ('00000000-0000-0000-0000-000000005e01','00000000-0000-0000-0000-000000005a01','camp','Camp','camp','published', 10);

insert into program_options (id, organization_id, program_id, name, price_cents) values
  ('00000000-0000-0000-0000-000000005f01','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005e01','Passe',60000);

-- 01 paga e reembolsada em parte; 02 em aberto vencida, parte compensando;
-- 03 anulada; 04 da noite em Nova York; 05 com pagamento falho.
insert into invoices (id, organization_id, athlete_id, number, status, subtotal_cents, total_cents, due_on, created_at) values
  ('00000000-0000-0000-0000-000000005101','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d01','D-1','paid',  60000,60000,null,        '2026-03-05 15:00+00'),
  ('00000000-0000-0000-0000-000000005102','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d02','D-2','open',  30000,30000,'2026-03-10','2026-03-06 15:00+00'),
  ('00000000-0000-0000-0000-000000005103','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d01','D-3','void',  99900,99900,null,        '2026-03-07 15:00+00'),
  ('00000000-0000-0000-0000-000000005104','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d02','D-4','paid',  10000,10000,null,        '2026-03-08 15:00+00'),
  ('00000000-0000-0000-0000-000000005105','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d02','D-5','open',   5000, 5000,null,        '2026-02-08 15:00+00');

insert into registrations (id, organization_id, athlete_id, program_id, program_option_id, status, invoice_id, created_at) values
  ('00000000-0000-0000-0000-000000005201','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d01','00000000-0000-0000-0000-000000005e01','00000000-0000-0000-0000-000000005f01','approved','00000000-0000-0000-0000-000000005101','2026-03-02 15:00+00'),
  ('00000000-0000-0000-0000-000000005202','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d02','00000000-0000-0000-0000-000000005e01','00000000-0000-0000-0000-000000005f01','approved',null,'2026-03-03 15:00+00'),
  ('00000000-0000-0000-0000-000000005203','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005d02',null,null,'pending',null,'2026-02-03 15:00+00');

insert into payments (id, organization_id, invoice_id, provider, method, status, amount_cents, paid_at, external_id, recorded_by) values
  -- Dois reembolsos parciais: a linha guarda o total acumulado, 100 e depois 150.
  ('00000000-0000-0000-0000-000000005301','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005101','stripe','card','partially_refunded',60000,'2026-03-05 16:00+00','pi_1',null),
  -- 01h de 1º de abril em UTC ainda é 31 de março em Nova York.
  ('00000000-0000-0000-0000-000000005304','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005104','offline','venmo','succeeded',10000,'2026-04-01 01:00+00',null,'00000000-0000-0000-0000-000000005b01'),
  ('00000000-0000-0000-0000-000000005305','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005102','stripe','us_bank_account','pending',8000,null,'pi_2',null),
  ('00000000-0000-0000-0000-000000005306','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005105','stripe','card','failed',5000,'2026-03-09 15:00+00','pi_3',null),
  -- Mês anterior, para a comparação.
  ('00000000-0000-0000-0000-000000005307','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005104','offline','cash','succeeded',2500,'2026-02-10 15:00+00',null,'00000000-0000-0000-0000-000000005b01');

insert into refunds (organization_id, payment_id, amount_cents, external_id, status) values
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005301',100,'ch:100','refunded'),
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005301',150,'ch:150','refunded');

insert into sessions (id, organization_id, title, starts_at, ends_at, status, published_at) values
  ('00000000-0000-0000-0000-000000005401','00000000-0000-0000-0000-000000005a01','Treino','2026-03-11 15:00+00','2026-03-11 16:30+00','completed', now()),
  ('00000000-0000-0000-0000-000000005402','00000000-0000-0000-0000-000000005a01','Chuva', '2026-03-12 15:00+00','2026-03-12 16:30+00','canceled', now()),
  ('00000000-0000-0000-0000-000000005403','00000000-0000-0000-0000-000000005a01','Rascunho','2026-03-13 15:00+00','2026-03-13 16:00+00','scheduled', null);

insert into session_attendance (organization_id, session_id, athlete_id, status) values
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005401','00000000-0000-0000-0000-000000005d01','present'),
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005401','00000000-0000-0000-0000-000000005d02','no_show'),
  ('00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-000000005401','00000000-0000-0000-0000-000000005d03','excused');

set local role authenticated;

-- Coach ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005b02","role":"authenticated"}', true);

select throws_ok(
  $$ select dashboard_finance('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') $$,
  'forbidden', 'coach não vê dinheiro'
);

select lives_ok(
  $$ select dashboard_operations('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') $$,
  'coach vê a operação'
);

-- Outra organização ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005b03","role":"authenticated"}', true);

select throws_ok(
  $$ select dashboard_finance('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') $$,
  'forbidden', 'admin de outra organização não vê dinheiro'
);
select throws_ok(
  $$ select dashboard_operations('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') $$,
  'forbidden', 'admin de outra organização não vê a operação'
);

-- Admin ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005b01","role":"authenticated"}', true);

create temp table f on commit drop as
  select dashboard_finance('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') as j;
create temp table o on commit drop as
  select dashboard_operations('00000000-0000-0000-0000-000000005a01','2026-03-01','2026-03-31','2026-02-01','2026-02-28') as j;

select is((select (j->>'received_cents')::int from f), 69850,
  'recebido: 60000 - 150 de reembolso acumulado + 10000 do fim da noite; falho e pendente fora');
select is((select (j->>'refunded_cents')::int from f), 150, 'reembolso usa o maior acumulado, não a soma');
select is((select (j->>'prev_received_cents')::int from f), 2500, 'período anterior separado');
select is((select (j->>'payment_count')::int from f), 2, 'conta só pagamento que entrou');

select is(
  (select e->>'value' from f, jsonb_array_elements(j->'daily') e where e->>'day' = '2026-03-31'),
  '10000',
  'pagamento das 21h em Nova York cai no dia certo do clube'
);

select is((select (j->>'invoiced_cents')::int from f), 100000, 'faturado não conta fatura anulada');
select is((select (j->>'collected_of_invoiced_cents')::int from f), 70000, 'recebido do que foi faturado');

select is(
  (select jsonb_array_length(j->'open_invoices') from f), 2, 'só fatura aberta com saldo');
select is(
  (select (e->>'pending_cents')::int from f, jsonb_array_elements(j->'open_invoices') e where e->>'number' = 'D-2'),
  8000, 'valor compensando vem separado do saldo');

select is(
  (select e->>'key' from f, jsonb_array_elements(j->'by_method') e where (e->>'value')::int = 59850),
  'card', 'forma de pagamento já líquida de reembolso');
select is(
  (select (e->>'value')::int from f, jsonb_array_elements(j->'by_program') e where e->>'key' = 'Camp'),
  59850, 'receita por programa');
select is(
  (select count(*)::int from f, jsonb_array_elements(j->'by_program') e where e->>'key' is null),
  1, 'pagamento sem programa não some do total');
select is((select (j->>'uninvoiced_count')::int from f), 1, 'aprovada com preço e sem fatura');
select is((select jsonb_array_length(j->'monthly') from f), 12, 'sempre doze meses, mesmo sem venda');

select is((select (j->>'registrations')::int from o), 2, 'inscrições do período');
select is((select (j->>'prev_registrations')::int from o), 1, 'inscrições do período anterior');
select is((select (j->>'active_athletes')::int from o), 2, 'só atleta ativo');
select is((select (j->>'sessions_held')::int from o), 1, 'treino cancelado e rascunho não contam');
select is((select (j->>'minutes_trained')::int from o), 90, 'minutos do treino realizado');
select is((select (j->>'attended')::int + (j->>'missed')::int from o), 2, 'justificado não vira falta nem presença');
select is((select (j->'funnel'->>'paid')::int from o), 1, 'funil chega até a fatura paga');

select * from finish();
rollback;
