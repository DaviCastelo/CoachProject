-- Fase 4 — caixa de saída de notificações.
--
-- Duas coisas são testadas aqui, e as duas são sobre confiança da família:
--
--  * a trava de duplicidade. A família não pode receber dois e-mails dizendo
--    que a mesma fatura foi emitida, e um retry do remetente não pode gerar
--    mensagem nova;
--  * para QUEM a cobrança vai. `can_pay` e `can_receive_comms` não são
--    decoração: mandar cobrança para quem marcou que não quer receber, ou para
--    quem não é quem paga, queima a confiança da família na plataforma.

begin;
select plan(16);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-00000001a001','org-notif','Org Notif');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-00000001b001','admin@notif.test',  crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000001b003','parent@notif.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001b001','admin'),
  ('00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001b003','guardian');

-- A household 4 fica SEM e-mail de propósito: é o caso em que não há para
-- quem mandar, e a função tem que devolver nada em vez de inventar destino.
insert into households (id, organization_id, name, primary_email) values
  ('00000000-0000-0000-0000-00000001c001','00000000-0000-0000-0000-00000001a001','Silva','casa1@notif.test'),
  ('00000000-0000-0000-0000-00000001c002','00000000-0000-0000-0000-00000001a001','Souza','casa2@notif.test'),
  ('00000000-0000-0000-0000-00000001c003','00000000-0000-0000-0000-00000001a001','Lima','casa3@notif.test'),
  ('00000000-0000-0000-0000-00000001c004','00000000-0000-0000-0000-00000001a001','Costa', null),
  ('00000000-0000-0000-0000-00000001c005','00000000-0000-0000-0000-00000001a001','Rojas','casa5@notif.test');

insert into athletes (id, organization_id, household_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-00000001d001','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c001','A','Silva','2015-01-01'),
  ('00000000-0000-0000-0000-00000001d002','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c002','B','Souza','2015-01-01'),
  ('00000000-0000-0000-0000-00000001d003','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c003','C','Lima','2015-01-01'),
  ('00000000-0000-0000-0000-00000001d004','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c004','D','Costa','2015-01-01'),
  ('00000000-0000-0000-0000-00000001d005','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c005','E','Rojas','2015-01-01');

insert into guardians (id, organization_id, household_id, user_id, first_name, last_name,
                       email, is_primary, preferred_language) values
  -- Dois responsáveis elegíveis no mesmo atleta: o principal tem que ganhar.
  ('00000000-0000-0000-0000-00000001e001','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c001',
   '00000000-0000-0000-0000-00000001b003','Segundo','Silva','segundo@notif.test', false, 'en'),
  ('00000000-0000-0000-0000-00000001e002','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c001',
   null,'Maria','Silva','maria@notif.test', true, 'en'),
  ('00000000-0000-0000-0000-00000001e003','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c002',
   null,'Nao','Paga','naopaga@notif.test', true, 'en'),
  ('00000000-0000-0000-0000-00000001e004','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c003',
   null,'Sem','Contato','semcontato@notif.test', true, 'en'),
  ('00000000-0000-0000-0000-00000001e005','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001c005',
   null,'Carmen','Rojas','carmen@notif.test', true, 'es');

insert into guardian_athletes (guardian_id, athlete_id, can_pay, can_receive_comms) values
  ('00000000-0000-0000-0000-00000001e001','00000000-0000-0000-0000-00000001d001', true,  true),
  ('00000000-0000-0000-0000-00000001e002','00000000-0000-0000-0000-00000001d001', true,  true),
  -- Não é quem paga: a cobrança não vai para ele.
  ('00000000-0000-0000-0000-00000001e003','00000000-0000-0000-0000-00000001d002', false, true),
  -- Pediu para não receber comunicação: a cobrança não vai para ele.
  ('00000000-0000-0000-0000-00000001e004','00000000-0000-0000-0000-00000001d003', true,  false),
  ('00000000-0000-0000-0000-00000001e005','00000000-0000-0000-0000-00000001d005', true,  true);

insert into invoices (id, organization_id, athlete_id, household_id, number, status,
                      subtotal_cents, discount_cents, total_cents) values
  ('00000000-0000-0000-0000-00000001f001','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001d001','00000000-0000-0000-0000-00000001c001','2026-0001','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-00000001f002','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001d002','00000000-0000-0000-0000-00000001c002','2026-0002','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-00000001f003','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001d003','00000000-0000-0000-0000-00000001c003','2026-0003','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-00000001f004','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001d004','00000000-0000-0000-0000-00000001c004','2026-0004','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-00000001f005','00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-00000001d005','00000000-0000-0000-0000-00000001c005','2026-0005','open', 60000, 0, 60000);

-- ---------------------------------------------------------------------------
-- Para quem a cobrança vai
-- ---------------------------------------------------------------------------

select is(
  (select email from invoice_billing_contact('00000000-0000-0000-0000-00000001f001')),
  'maria@notif.test',
  'Among eligible guardians the primary one is chosen'
);

-- O nome vem junto porque "Olá," sozinho é pior que nada.
select is(
  (select name from invoice_billing_contact('00000000-0000-0000-0000-00000001f001')),
  'Maria Silva',
  'The contact carries the guardian name, not just the address'
);

select is(
  (select email from invoice_billing_contact('00000000-0000-0000-0000-00000001f002')),
  'casa2@notif.test',
  'A guardian who is not the payer is skipped in favour of the household email'
);

select is(
  (select email from invoice_billing_contact('00000000-0000-0000-0000-00000001f003')),
  'casa3@notif.test',
  'A guardian who opted out of comms is skipped in favour of the household email'
);

-- A família que escolheu espanhol não deveria receber cobrança em inglês.
select is(
  (select locale from invoice_billing_contact('00000000-0000-0000-0000-00000001f005')),
  'es',
  'The contact carries the guardian preferred language'
);

select is(
  (select count(*)::int from invoice_billing_contact('00000000-0000-0000-0000-00000001f004')),
  0,
  'With no eligible guardian and no household email there is no contact at all'
);

-- ---------------------------------------------------------------------------
-- A fila
-- ---------------------------------------------------------------------------

select ok(
  (select enqueue_notification(
     '00000000-0000-0000-0000-00000001a001', 'invoice_created', 'maria@notif.test',
     'Fatura 2026-0001', 'Corpo da mensagem.',
     'invoice_created:00000000-0000-0000-0000-00000001f001',
     'Maria Silva', '{}'::jsonb, '00000000-0000-0000-0000-00000001f001')) is not null,
  'Enqueueing a notification returns the new row id'
);

-- Enfileirar duas vezes é esperado (dois cliques, um retry). O segundo não
-- pode levantar erro: falhar aqui abortaria a transação de quem chamou — no
-- caso da aprovação, a inscrição não seria aprovada por causa de um e-mail.
select is(
  (select enqueue_notification(
     '00000000-0000-0000-0000-00000001a001', 'invoice_created', 'maria@notif.test',
     'Fatura 2026-0001', 'Corpo da mensagem.',
     'invoice_created:00000000-0000-0000-0000-00000001f001',
     'Maria Silva', '{}'::jsonb, '00000000-0000-0000-0000-00000001f001')),
  null::uuid,
  'Re-enqueueing the same dedupe key returns null instead of raising'
);

select is(
  (select count(*)::int from notifications
    where dedupe_key = 'invoice_created:00000000-0000-0000-0000-00000001f001'),
  1,
  'The duplicate never becomes a second queued message'
);

select is(
  (select enqueue_notification(
     '00000000-0000-0000-0000-00000001a001', 'invoice_reminder', '   ',
     'Lembrete', 'Corpo.', 'invoice_reminder:sem-endereco')),
  null::uuid,
  'Without an address there is nothing to enqueue'
);

select is(
  (select count(*)::int from notifications where dedupe_key = 'invoice_reminder:sem-endereco'),
  0,
  'The addressless notification leaves no row behind'
);

-- O endereço é normalizado na entrada, para o dedupe não ser furado por
-- maiúsculas e espaço sobrando.
do $$ begin
  perform enqueue_notification(
    '00000000-0000-0000-0000-00000001a001', 'payment_received', '  MiXeD@Notif.TEST  ',
    'Recibo', 'Corpo.', 'payment_received:normaliza');
end $$;

select is(
  (select recipient from notifications where dedupe_key = 'payment_received:normaliza'),
  'mixed@notif.test',
  'The recipient address is lowercased and trimmed on the way in'
);

-- ---------------------------------------------------------------------------
-- Quem vê a fila
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000001b001","role":"authenticated"}', true);

select is(
  (select count(*)::int from notifications),
  2,
  'Staff reads the outbox: it is an operations screen'
);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000001b003","role":"authenticated"}', true);

-- O corpo da mensagem fica legível na fila, então a fila não pode ser pública
-- dentro da organização: um responsável leria a cobrança de outra família.
select is(
  (select count(*)::int from notifications),
  0,
  'A guardian cannot read the outbox'
);

select throws_ok(
  $$insert into notifications (organization_id, type, recipient, subject, body, dedupe_key)
    values ('00000000-0000-0000-0000-00000001a001','invoice_created','x@y.test','s','b','forjado')$$,
  '42501',
  null,
  'Only the server writes to the outbox'
);

-- A 0033 concedia esta função a `authenticated` e ela é SECURITY DEFINER sem
-- checagem por dentro: bastava um UUID de fatura para extrair o e-mail e o
-- nome de QUALQUER família, de qualquer organização, furando a RLS. O UUID
-- viaja no link público `/pay/<uuid>`, então não é segredo. A 0035 tirou o
-- grant; esta asserção é o que impede alguém de concedê-lo de novo sem notar.
select throws_ok(
  $$select email from invoice_billing_contact('00000000-0000-0000-0000-00000001f001')$$,
  '42501',
  null,
  'The billing contact lookup is server-only: no logged-in user can call it'
);

select * from finish();
rollback;
