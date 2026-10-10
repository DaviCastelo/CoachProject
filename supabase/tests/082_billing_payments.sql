-- Fase 4 — baixa de pagamento, manual e por webhook.
--
-- Duas asserções aqui valem mais que todas as outras juntas:
--
--  * a Stripe REENVIA o mesmo evento, e o reenvio não pode creditar o valor
--    duas vezes na fatura (um pagamento de $600 virando $1.200);
--  * no ACH o dinheiro fica `pending` por dias e PODE falhar depois, então
--    `pending` nunca pode fechar a fatura como paga. É o que impede a vaga de
--    ser liberada antes de o dinheiro existir.
--
-- O resto do arquivo cobre quem pode dar baixa na mão e o que a função recusa.

begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- Duas organizações: na B o coach tem permissão de dar baixa, na A não
-- ---------------------------------------------------------------------------

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000ea001','org-pay-a','Org Pay A'),
  ('00000000-0000-0000-0000-0000000ea002','org-pay-b','Org Pay B');

insert into org_settings (organization_id, key, value) values
  ('00000000-0000-0000-0000-0000000ea002','payments.coach_can_record','true');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-0000000e0001','admin@pay.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000e0002','coach@pay.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000e0001','admin'),
  ('00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000e0002','coach'),
  ('00000000-0000-0000-0000-0000000ea002','00000000-0000-0000-0000-0000000e0001','admin'),
  ('00000000-0000-0000-0000-0000000ea002','00000000-0000-0000-0000-0000000e0002','coach');

insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-0000000ed001','00000000-0000-0000-0000-0000000ea001','Pay','pay@pay.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000ee001','00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000ed001','P','Pay','2015-01-01');

insert into programs (id, organization_id, slug, name, type, status) values
  ('00000000-0000-0000-0000-0000000e7001','00000000-0000-0000-0000-0000000ea001','camp-pay','Camp Pay','camp','published');

insert into program_options (id, organization_id, program_id, name, price_cents) values
  ('00000000-0000-0000-0000-0000000e8001','00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000e7001','Full Pass', 60000);

insert into invoices (id, organization_id, athlete_id, household_id, number, status,
                      subtotal_cents, discount_cents, total_cents) values
  ('00000000-0000-0000-0000-0000000ef001','00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000ee001','00000000-0000-0000-0000-0000000ed001','2026-0001','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef002','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0002','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef003','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0003','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef004','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0004','void', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef005','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0005','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef007','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0007','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef008','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0008','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef009','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0009','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef00a','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0010','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef00b','00000000-0000-0000-0000-0000000ea001', null, null,'2026-0011','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000ef006','00000000-0000-0000-0000-0000000ea002', null, null,'2026-0001','open', 60000, 0, 60000);

-- Inscrição com vaga reservada, apontando para a fatura que vai ser quitada.
insert into registrations (id, organization_id, athlete_id, program_id, program_option_id,
                           invoice_id, reserved_until) values
  ('00000000-0000-0000-0000-0000000e9001','00000000-0000-0000-0000-0000000ea001',
   '00000000-0000-0000-0000-0000000ee001','00000000-0000-0000-0000-0000000e7001',
   '00000000-0000-0000-0000-0000000e8001','00000000-0000-0000-0000-0000000ef001', now() + interval '72 hours');

-- ---------------------------------------------------------------------------
-- Baixa manual pelo admin
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000e0001","role":"authenticated"}', true);

do $$ begin
  perform record_offline_payment(
    '00000000-0000-0000-0000-0000000ef001', 'venmo', 60000, 'nota: Joao - camp');
end $$;

-- Offline já nasce succeeded: a confirmação foi humana, não existe
-- "processando" quando alguém olhou o extrato antes de clicar.
select is(
  (select status::text from payments where invoice_id = '00000000-0000-0000-0000-0000000ef001'),
  'succeeded',
  'An offline payment is recorded as succeeded, not pending'
);

select is(
  (select status::text from invoices where id = '00000000-0000-0000-0000-0000000ef001'),
  'paid',
  'Paying the full amount closes the invoice'
);

-- Fatura quitada solta a reserva: a vaga deixa de ser provisória.
select ok(
  (select reserved_until from registrations where id = '00000000-0000-0000-0000-0000000e9001') is null,
  'A paid invoice releases the slot hold'
);

select is(
  (select recorded_by from payments where invoice_id = '00000000-0000-0000-0000-0000000ef001'),
  '00000000-0000-0000-0000-0000000e0001'::uuid,
  'The manual payment records who marked it'
);

-- Pagamento parcial: a fatura continua aberta pelo que falta.
do $$ begin
  perform record_offline_payment('00000000-0000-0000-0000-0000000ef002', 'check', 20000, '#1042');
end $$;

select is(
  (select status::text from invoices where id = '00000000-0000-0000-0000-0000000ef002'),
  'open',
  'A partial payment leaves the invoice open'
);

select is(
  (select balance_cents from invoice_balances where invoice_id = '00000000-0000-0000-0000-0000000ef002'),
  40000,
  'The remaining balance reflects the partial payment'
);

-- ---------------------------------------------------------------------------
-- O que a função recusa
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select record_offline_payment('00000000-0000-0000-0000-0000000ef007', 'card', 60000)$$,
  'P0001',
  'card não é método offline; pagamento de gateway entra pelo webhook',
  'A gateway method cannot be marked by hand'
);

select throws_ok(
  $$select record_offline_payment('00000000-0000-0000-0000-0000000ef008', 'cash', 0)$$,
  'P0001',
  'valor do pagamento precisa ser positivo',
  'A non-positive amount is rejected'
);

select throws_ok(
  $$select record_offline_payment('00000000-0000-0000-0000-0000000ef004', 'cash', 60000)$$,
  'P0001',
  'fatura 2026-0004 está void, não aceita pagamento',
  'A voided invoice does not accept payment'
);

-- ---------------------------------------------------------------------------
-- Quem pode dar baixa: a pergunta que virou configuração
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000e0002","role":"authenticated"}', true);

select throws_ok(
  $$select record_offline_payment('00000000-0000-0000-0000-0000000ef005', 'venmo', 60000)$$,
  'P0001',
  'sem permissão para registrar pagamento nesta organização',
  'By default a coach cannot record payments'
);

select lives_ok(
  $$select record_offline_payment('00000000-0000-0000-0000-0000000ef006', 'venmo', 60000)$$,
  'A coach can record payments where the org turned it on'
);

-- ---------------------------------------------------------------------------
-- Webhook da Stripe: a partir daqui é o servidor, não uma pessoa
-- ---------------------------------------------------------------------------

reset role;

do $$ begin
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef009', 'pi_test_600', 'card', 'succeeded', 60000, 1770, now());
end $$;

select is(
  (select status::text from invoices where id = '00000000-0000-0000-0000-0000000ef009'),
  'paid',
  'A succeeded Stripe payment closes the invoice'
);

-- A Stripe manda payment_intent.succeeded mais de uma vez com frequência.
do $$ begin
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef009', 'pi_test_600', 'card', 'succeeded', 60000, 1770, now());
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef009', 'pi_test_600', 'card', 'succeeded', 60000, 1770, now());
end $$;

select is(
  (select count(*)::int from payments where invoice_id = '00000000-0000-0000-0000-0000000ef009'),
  1,
  'Replaying the same PaymentIntent updates one payment instead of adding more'
);

select is(
  (select paid_cents from invoice_balances where invoice_id = '00000000-0000-0000-0000-0000000ef009'),
  60000,
  'A replayed event does not double the amount credited to the invoice'
);

-- A taxa real só chega quando a transação entra no saldo, DEPOIS do succeeded.
-- Um evento mais novo sem taxa não pode apagar a que já veio.
do $$ begin
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef00a', 'pi_test_fee', 'card', 'succeeded', 60000, 1770, now());
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef00a', 'pi_test_fee', 'card', 'succeeded', 60000, null, now());
end $$;

select is(
  (select fee_cents from payments where external_id = 'pi_test_fee'),
  1770,
  'A later event without a fee does not erase the fee already recorded'
);

-- O ACH: dinheiro que ainda não existe não fecha fatura.
do $$ begin
  perform apply_stripe_payment(
    '00000000-0000-0000-0000-0000000ef003', 'pi_test_ach', 'us_bank_account', 'pending', 60000);
end $$;

select is(
  (select status::text from invoices where id = '00000000-0000-0000-0000-0000000ef003'),
  'open',
  'An ACH payment still settling leaves the invoice open'
);

select is(
  (select pending_cents from invoice_balances where invoice_id = '00000000-0000-0000-0000-0000000ef003'),
  60000,
  'The settling amount shows as pending, never as paid'
);

-- A trava de banco, por baixo da RPC: o mesmo PaymentIntent não entra duas vezes.
select throws_ok(
  $$insert into payments (organization_id, invoice_id, provider, method, status, amount_cents, external_id)
    values ('00000000-0000-0000-0000-0000000ea001','00000000-0000-0000-0000-0000000ef00b',
            'stripe','card','succeeded', 60000, 'pi_test_600')$$,
  '23505',
  null,
  'The unique index refuses a second payment with the same external id'
);

select * from finish();
rollback;
