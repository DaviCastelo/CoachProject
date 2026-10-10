-- Fase 4 (P1) — caixa de saída de notificações.
--
-- Hoje não existe envio de e-mail no projeto: entre a família se inscrever e
-- receber o link de pagamento existe uma pessoa copiando link. O bloco G6 do
-- plano depende de uma conta Resend, que o cliente ainda não abriu.
--
-- A escolha aqui é NÃO esperar por essa conta. O sistema passa a registrar
-- toda notificação que deveria sair, com destinatário, assunto e corpo
-- prontos. Enquanto não houver chave da Resend, elas ficam `pending` e o
-- admin vê a fila. No dia em que a chave chegar, o mesmo código começa a
-- enviar — inclusive o que ficou acumulado, se for o caso.
--
-- O padrão é um outbox: o banco guarda a intenção, um remetente a consome.
-- Sem isso, "preparar para o Resend" viraria código morto que ninguém sabe
-- se funciona.

create table notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,

  -- invoice_created | payment_received | invoice_reminder
  type             text not null,
  channel          text not null default 'email',

  recipient        text not null,
  recipient_name   text,
  subject          text not null,
  body             text not null,

  -- Dados que geraram a mensagem. Servem para reenviar em outro idioma ou
  -- depois de corrigir um template, sem precisar reconstruir o contexto.
  payload          jsonb not null default '{}',

  invoice_id       uuid references invoices(id) on delete set null,
  payment_id       uuid references payments(id) on delete set null,

  -- pending | sent | failed | skipped
  status           text not null default 'pending',
  provider         text,
  provider_id      text,
  error            text,
  attempts         int not null default 0,

  /*
   * Trava de duplicidade. A família não pode receber dois e-mails dizendo
   * que a mesma fatura foi emitida, e um retry do remetente não pode gerar
   * mensagem nova.
   *
   *   invoice_created:<invoice_id>
   *   payment_received:<payment_id>
   *   invoice_reminder:<invoice_id>:<AAAA-MM-DD>   (um por dia, no máximo)
   */
  dedupe_key       text not null,

  created_at       timestamptz not null default now(),
  sent_at          timestamptz,

  unique (dedupe_key),
  constraint notifications_status_valid
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create index on notifications (organization_id, status, created_at desc);
create index on notifications (status, created_at) where status = 'pending';
create index on notifications (invoice_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table notifications enable row level security;

-- A fila é operação: staff lê para saber o que saiu e o que travou. Só o
-- servidor escreve, porque é ele que fala com o provedor de e-mail.
create policy notifications_staff_read on notifications
  for select using (is_staff(organization_id));

revoke all on notifications from anon;
revoke insert, update, delete on notifications from authenticated;

-- ---------------------------------------------------------------------------
-- enqueue_notification
-- ---------------------------------------------------------------------------

-- `on conflict do nothing` em vez de erro: enfileirar duas vezes é esperado
-- (dois cliques, um retry), e falhar aí abortaria a transação de quem chamou
-- — no caso da aprovação, a inscrição não seria aprovada por causa de um
-- e-mail repetido. A notificação é consequência, não requisito.
create or replace function enqueue_notification(
  p_organization_id uuid,
  p_type            text,
  p_recipient       text,
  p_subject         text,
  p_body            text,
  p_dedupe_key      text,
  p_recipient_name  text default null,
  p_payload         jsonb default '{}',
  p_invoice_id      uuid default null,
  p_payment_id      uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_recipient), '') = '' then
    return null;  -- sem endereço não há o que enfileirar
  end if;

  insert into notifications (
    organization_id, type, recipient, recipient_name, subject, body,
    dedupe_key, payload, invoice_id, payment_id
  ) values (
    p_organization_id, p_type, lower(trim(p_recipient)), p_recipient_name,
    p_subject, p_body, p_dedupe_key, coalesce(p_payload, '{}'), p_invoice_id, p_payment_id
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end $$;

revoke all on function enqueue_notification(uuid, text, text, text, text, text, text, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function enqueue_notification(uuid, text, text, text, text, text, text, jsonb, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Quem recebe a cobrança de uma fatura
-- ---------------------------------------------------------------------------

/*
 * Quem recebe a cobrança, em ordem de preferência:
 *
 *   1. responsável do atleta que pode pagar (`can_pay`) e aceita receber
 *      comunicação (`can_receive_comms`), preferindo o principal
 *   2. o e-mail da household
 *
 * `can_pay` e `can_receive_comms` não são decoração: mandar cobrança para
 * quem marcou que não quer receber, ou para quem não é quem paga, queima a
 * confiança da família na plataforma.
 *
 * Devolve nome e idioma junto. Nome porque "Olá," sozinho é pior que nada, e
 * idioma porque `guardians.preferred_language` existe e a família que
 * escolheu espanhol não deveria receber cobrança em inglês.
 */
create or replace function invoice_billing_contact(p_invoice_id uuid)
returns table (email text, name text, locale text)
language sql stable security definer set search_path = public as $$
  with inv as (
    select athlete_id, household_id from invoices where id = p_invoice_id
  ),
  responsavel as (
    select
      g.email,
      nullif(trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as name,
      coalesce(g.preferred_language, 'en') as locale,
      g.is_primary
    from inv
    join guardian_athletes ga on ga.athlete_id = inv.athlete_id
    join guardians g on g.id = ga.guardian_id
    where coalesce(trim(g.email), '') <> ''
      and ga.can_pay
      and ga.can_receive_comms
    order by g.is_primary desc, g.created_at
    limit 1
  )
  select email, name, locale from responsavel
  union all
  select h.primary_email, h.name, 'en'
    from inv
    join households h on h.id = inv.household_id
   where not exists (select 1 from responsavel)
     and coalesce(trim(h.primary_email), '') <> ''
  limit 1
$$;

revoke all on function invoice_billing_contact(uuid) from public, anon;
grant execute on function invoice_billing_contact(uuid) to authenticated, service_role;
