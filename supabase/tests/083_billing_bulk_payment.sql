-- Fase 4 — baixa manual em lote.
--
-- Na semana que abre a inscrição de um camp chegam 60 a 80 pagamentos de Venmo
-- em poucos dias. O lote existe para isso, e a promessa dele é tudo ou nada:
-- uma falha no meio não pode deixar metade lançada com ninguém sabendo onde
-- parou. A asserção de atomicidade abaixo é a que prova essa promessa.

begin;
select plan(13);

insert into organizations (id, slug, name) values
  ('00000000-0000-0000-0000-0000000fa001','org-bulk','Org Bulk');

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-0000000f0001','admin@bulk.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000f0002','coach@bulk.test', crypt('password', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000fa001','00000000-0000-0000-0000-0000000f0001','admin'),
  ('00000000-0000-0000-0000-0000000fa001','00000000-0000-0000-0000-0000000f0002','coach');

insert into invoices (id, organization_id, number, status, subtotal_cents, discount_cents, total_cents) values
  ('00000000-0000-0000-0000-0000000fb001','00000000-0000-0000-0000-0000000fa001','2026-0001','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb002','00000000-0000-0000-0000-0000000fa001','2026-0002','open', 45000, 0, 45000),
  ('00000000-0000-0000-0000-0000000fb003','00000000-0000-0000-0000-0000000fa001','2026-0003','open', 30000, 0, 30000),
  ('00000000-0000-0000-0000-0000000fb005','00000000-0000-0000-0000-0000000fa001','2026-0005','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb006','00000000-0000-0000-0000-0000000fa001','2026-0006','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb007','00000000-0000-0000-0000-0000000fa001','2026-0007','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb008','00000000-0000-0000-0000-0000000fa001','2026-0008','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb009','00000000-0000-0000-0000-0000000fa001','2026-0009','open', 60000, 0, 60000),
  ('00000000-0000-0000-0000-0000000fb00a','00000000-0000-0000-0000-0000000fa001','2026-0010','open', 60000, 0, 60000);

-- A fatura 0007 já recebeu um sinal de 20000: o lote tem que lançar só o que
-- falta, não o total de novo.
insert into payments (organization_id, invoice_id, provider, method, status,
                      amount_cents, recorded_by, paid_at) values
  ('00000000-0000-0000-0000-0000000fa001','00000000-0000-0000-0000-0000000fb007',
   'offline','cash','succeeded', 20000, '00000000-0000-0000-0000-0000000f0001', now());

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000f0001","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- O caminho feliz
-- ---------------------------------------------------------------------------

select is(
  (select record_offline_payments_bulk(
     array['00000000-0000-0000-0000-0000000fb001',
           '00000000-0000-0000-0000-0000000fb002',
           '00000000-0000-0000-0000-0000000fb003']::uuid[],
     'venmo',
     array['nota-joao','nota-ana','nota-pedro'])),
  3,
  'The batch reports how many invoices it actually settled'
);

select is(
  (select count(*)::int from invoices
    where id in ('00000000-0000-0000-0000-0000000fb001',
                 '00000000-0000-0000-0000-0000000fb002',
                 '00000000-0000-0000-0000-0000000fb003')
      and status = 'paid'),
  3,
  'Every invoice in the batch ends up paid'
);

-- Cada fatura recebe o valor do SEU saldo, não um valor único para o lote.
select is(
  (select amount_cents from payments where invoice_id = '00000000-0000-0000-0000-0000000fb002'),
  45000,
  'Each invoice is settled for its own outstanding balance'
);

-- As observações são posicionais: a terceira nota vai para a terceira fatura.
select is(
  (select reference from payments where invoice_id = '00000000-0000-0000-0000-0000000fb003'),
  'nota-pedro',
  'References line up with the invoices by position'
);

-- ---------------------------------------------------------------------------
-- Fatura quitada entre a tela carregar e o botão ser clicado
-- ---------------------------------------------------------------------------

-- Lançar de novo criaria crédito que alguém teria que devolver na mão, então
-- a já paga é pulada e não entra na contagem.
select is(
  (select record_offline_payments_bulk(
     array['00000000-0000-0000-0000-0000000fb001',   -- já paga acima
           '00000000-0000-0000-0000-0000000fb009',
           '00000000-0000-0000-0000-0000000fb00a']::uuid[],
     'venmo')),
  2,
  'An invoice already settled is skipped instead of paid twice'
);

select is(
  (select count(*)::int from payments where invoice_id = '00000000-0000-0000-0000-0000000fb001'),
  1,
  'The skipped invoice gains no second payment'
);

-- O saldo parcial: o lote lança 40000, não 60000.
select is(
  (select record_offline_payments_bulk(
     array['00000000-0000-0000-0000-0000000fb007']::uuid[], 'venmo')),
  1,
  'A partially paid invoice is settled for the remainder'
);

select is(
  (select sum(amount_cents)::int from payments where invoice_id = '00000000-0000-0000-0000-0000000fb007'),
  60000,
  'The remainder plus the deposit equals the invoice total, never more'
);

-- ---------------------------------------------------------------------------
-- Atomicidade: a promessa do lote
-- ---------------------------------------------------------------------------

-- As duas primeiras faturas são válidas e seriam lançadas; a terceira não
-- existe. Se o lote não fosse uma transação, 0005 e 0006 ficariam pagas e a
-- pessoa não teria como saber onde a conferência parou.
select throws_ok(
  $$select record_offline_payments_bulk(
      array['00000000-0000-0000-0000-0000000fb005',
            '00000000-0000-0000-0000-0000000fb006',
            '00000000-0000-0000-0000-00000000dead']::uuid[], 'venmo')$$,
  'P0001',
  'fatura 00000000-0000-0000-0000-00000000dead não encontrada',
  'An unknown invoice in the batch aborts the whole call'
);

select is(
  (select count(*)::int from payments
    where invoice_id in ('00000000-0000-0000-0000-0000000fb005',
                         '00000000-0000-0000-0000-0000000fb006')),
  0,
  'Nothing from the aborted batch was written: it is all or nothing'
);

-- ---------------------------------------------------------------------------
-- Nada selecionado
-- ---------------------------------------------------------------------------

-- `array_length('{}', 1)` devolve NULL, não zero: é a pegadinha que a guarda
-- da função trata. Sem ela o lote vazio entraria no loop.
select is(
  (select record_offline_payments_bulk('{}'::uuid[], 'venmo')),
  0,
  'An empty selection settles nothing and does not error'
);

select is(
  (select record_offline_payments_bulk(null, 'venmo')),
  0,
  'A null array settles nothing and does not error'
);

-- ---------------------------------------------------------------------------
-- Teto defensivo
-- ---------------------------------------------------------------------------

-- A tela trabalha com dezenas. Um array gigante ou é engano ou é abuso.
select throws_ok(
  $$select record_offline_payments_bulk(
      (select array_agg(gen_random_uuid()) from generate_series(1, 501)), 'venmo')$$,
  'P0001',
  'lote grande demais: 501 faturas (máximo 500)',
  'A batch above the 500 cap is refused before anything is written'
);

select * from finish();
rollback;
