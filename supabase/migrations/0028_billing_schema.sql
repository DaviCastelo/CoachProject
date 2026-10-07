-- Fase 4 (P0) — schema de cobrança: faturas, pagamentos, estornos e eventos de webhook.
--
-- Decisões que vêm de 01-Planejamento/07-pagamentos-e-taxas.md:
--
--  * A fatura é NOSSA. Não usamos Stripe Invoicing (+0,4%) nem Stripe Billing
--    (+0,7%). A Stripe só move dinheiro, via PaymentIntent/Checkout.
--  * Todo gateway passa pela interface PaymentGateway, então o schema não
--    assume Stripe: `provider` distingue stripe de offline (Venmo/dinheiro/cheque).
--  * `payments.fee_cents` existe para instrumentar a decisão: em 90 dias o
--    relatório "taxa por método" mostra com dados reais quanto cada caminho
--    custou, em vez de opinião.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

-- draft          fatura montada mas ainda não cobrada
-- open           cobrável (a família já pode pagar)
-- paid           quitada
-- void           cancelada sem pagamento (não conta em inadimplência)
-- refunded       estornada depois de paga
-- uncollectible  desistiu-se de cobrar (continua no histórico)
create type invoice_status as enum
  ('draft', 'open', 'paid', 'void', 'refunded', 'uncollectible');

-- Quem move o dinheiro. 'offline' cobre tudo que é marcado na mão.
create type payment_provider as enum ('stripe', 'offline');

-- Como a família pagou. Os quatro primeiros vêm da Stripe; os demais são
-- registro manual. `us_bank_account` é o nome que a própria Stripe usa para ACH.
create type payment_method as enum (
  'card', 'us_bank_account', 'cash_app', 'link', 'apple_pay', 'google_pay',
  'venmo', 'cash', 'check', 'zelle', 'account_credit', 'other'
);

-- ATENÇÃO ao 'pending': no ACH o pagamento fica pendente por dias e PODE
-- falhar depois (conta sem saldo). Por isso 'succeeded' nunca é presumido na
-- criação — só o webhook payment_intent.succeeded promove para succeeded.
create type payment_status as enum (
  'pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded'
);

-- ---------------------------------------------------------------------------
-- invoices — a fatura da inscrição
-- ---------------------------------------------------------------------------

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  athlete_id       uuid references athletes(id) on delete set null,
  household_id     uuid references households(id) on delete set null,
  number           text not null,                 -- legível: "2026-0042"
  status           invoice_status not null default 'draft',
  currency         text not null default 'usd',
  subtotal_cents   int not null,
  discount_cents   int not null default 0,        -- inclui o desconto por ACH
  discount_reason  text,
  total_cents      int not null,
  due_on           date,
  memo             text,                          -- aparece para a família
  admin_notes      text,                          -- interno
  voided_at        timestamptz,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (organization_id, number),
  constraint invoices_amounts_non_negative
    check (subtotal_cents >= 0 and discount_cents >= 0 and total_cents >= 0),
  constraint invoices_total_matches
    check (total_cents = subtotal_cents - discount_cents)
);
create index on invoices (organization_id, status);
create index on invoices (athlete_id);
create index on invoices (household_id);
create index on invoices (organization_id, due_on) where status = 'open';

-- A coluna já existia em 0010 reservada ("FK adicionada na Fase 4"). Agora fecha.
alter table registrations
  add constraint registrations_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;
create index on registrations (invoice_id);

-- Reserva de vaga de inscrição não paga. O comportamento é configurável em
-- org_settings sob a chave 'payments.reservation':
--   {"mode":"none"}                   inscrição não paga não segura vaga
--   {"mode":"timed","hours":72}       segura 72h e o sistema libera sozinho (padrão)
--   {"mode":"unlimited"}              segura até alguém cancelar na mão
-- Com 'none' e 'unlimited' a coluna simplesmente fica null.
alter table registrations add column reserved_until timestamptz;
create index on registrations (reserved_until) where reserved_until is not null;

-- ---------------------------------------------------------------------------
-- payments — cada tentativa de pagamento de uma fatura
-- ---------------------------------------------------------------------------

create table payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  invoice_id       uuid not null references invoices(id) on delete cascade,
  provider         payment_provider not null,
  method           payment_method not null,
  status           payment_status not null default 'pending',
  amount_cents     int not null check (amount_cents > 0),

  -- Taxa real cobrada pela processadora. Null quando desconhecida (é o caso do
  -- Venmo marcado na mão, onde ninguém digita a taxa). Ver §7 do documento 07.
  fee_cents        int check (fee_cents is null or fee_cents >= 0),

  -- Id no provedor: payment_intent da Stripe. O unique parcial é a trava que
  -- impede o mesmo PaymentIntent virar dois pagamentos quando a Stripe
  -- reenvia o evento.
  external_id      text,

  -- Para pagamento offline: número do cheque, nota da transação do Venmo, etc.
  reference        text,

  -- Quem deu baixa na mão. Null em pagamento automático (foi o webhook).
  recorded_by      uuid references profiles(id),

  failure_reason   text,
  paid_at          timestamptz,                   -- quando virou 'succeeded'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Pagamento manual tem que dizer quem marcou; automático não tem gente.
  constraint payments_offline_needs_recorder
    check (provider <> 'offline' or recorded_by is not null),
  -- Pagamento da Stripe sempre tem id externo.
  constraint payments_stripe_needs_external_id
    check (provider <> 'stripe' or external_id is not null)
);
create unique index payments_provider_external_id_key
  on payments (provider, external_id) where external_id is not null;
create index on payments (invoice_id);
create index on payments (organization_id, status);
create index on payments (organization_id, method, paid_at);

-- ---------------------------------------------------------------------------
-- refunds
-- ---------------------------------------------------------------------------

create table refunds (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  payment_id       uuid not null references payments(id) on delete cascade,
  amount_cents     int not null check (amount_cents > 0),
  reason           text,
  external_id      text,
  status           payment_status not null default 'pending',
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);
create unique index refunds_external_id_key
  on refunds (external_id) where external_id is not null;
create index on refunds (payment_id);
create index on refunds (organization_id);

-- ---------------------------------------------------------------------------
-- webhook_events — idempotência
-- ---------------------------------------------------------------------------

-- A Stripe REENVIA eventos quando não recebe 200 rápido. Sem o unique abaixo,
-- um pagamento de $600 pode ser creditado duas vezes na mesma fatura.
create table webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         payment_provider not null,
  event_id         text not null,
  type             text not null,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  error            text,

  unique (provider, event_id)
);
create index on webhook_events (provider, type, received_at desc);
create index on webhook_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Saldo da fatura — derivado, nunca armazenado
-- ---------------------------------------------------------------------------

-- Guardar amount_paid na própria invoice convida a divergência: basta um
-- caminho de escrita esquecer de atualizar. Como o volume é de centenas de
-- linhas, somar na hora é barato e nunca mente.
create view invoice_balances as
  select
    i.id                                         as invoice_id,
    i.organization_id,
    i.total_cents,
    coalesce(sum(p.amount_cents) filter (
      where p.status in ('succeeded', 'partially_refunded')
    ), 0)::int                                   as paid_cents,
    coalesce(sum(p.amount_cents) filter (
      where p.status = 'pending'
    ), 0)::int                                   as pending_cents,
    (i.total_cents - coalesce(sum(p.amount_cents) filter (
      where p.status in ('succeeded', 'partially_refunded')
    ), 0))::int                                  as balance_cents
  from invoices i
  left join payments p on p.invoice_id = i.id
  group by i.id;

-- A view herda a RLS das invoices/payments (security_invoker), em vez de rodar
-- com os poderes do dono e furar o isolamento entre organizações.
alter view invoice_balances set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- Numeração da fatura
-- ---------------------------------------------------------------------------

-- Sequência por organização e por ano, sem buraco e sem corrida: o update com
-- returning serializa os concorrentes na própria linha.
create table invoice_counters (
  organization_id  uuid not null references organizations(id) on delete cascade,
  year             int  not null,
  last_number      int  not null default 0,
  primary key (organization_id, year)
);

create or replace function next_invoice_number(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into invoice_counters (organization_id, year, last_number)
    values (p_org, v_year, 1)
  on conflict (organization_id, year)
    do update set last_number = invoice_counters.last_number + 1
  returning last_number into v_next;

  return v_year || '-' || lpad(v_next::text, 4, '0');
end $$;

revoke all on function next_invoice_number(uuid) from public, anon, authenticated;
grant execute on function next_invoice_number(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- 0008 dá `select` a anon por default privileges. Dados financeiros não têm
-- por que ser legíveis pelo público nem em teoria, então tiramos o grant.
-- A RLS (0029) continua sendo a defesa principal; isto é a segunda camada.
revoke all on invoices, payments, refunds, webhook_events, invoice_counters from anon;
revoke all on invoice_balances from anon;

-- webhook_events e invoice_counters são infraestrutura: só o servidor escreve.
revoke all on webhook_events, invoice_counters from authenticated;

grant usage on type invoice_status   to authenticated;
grant usage on type payment_provider to authenticated;
grant usage on type payment_method   to authenticated;
grant usage on type payment_status   to authenticated;
