-- Fase 4 (P0) — RLS da cobrança.
--
-- Princípio: escrita financeira é de owner/admin. Coach LÊ (precisa saber se o
-- atleta está quitado para liberar o treino) mas não cria, não anula e não dá
-- baixa por padrão. Se o cliente responder que coach também pode marcar
-- pagamento, a porta é a chave 'payments.coach_can_record' em org_settings,
-- lida pela RPC — não é preciso reescrever política.
--
-- Família e atleta veem apenas as próprias faturas e pagamentos.
--
-- webhook_events e invoice_counters não recebem política nenhuma: com RLS
-- ligada e zero policies, ninguém com `authenticated` passa. Só o service_role
-- (que ignora RLS) escreve neles, e é exatamente o que queremos.

alter table invoices         enable row level security;
alter table payments         enable row level security;
alter table refunds          enable row level security;
alter table webhook_events   enable row level security;
alter table invoice_counters enable row level security;

-- ---------------------------------------------------------------------------
-- Helper de visibilidade
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER de propósito: a função lê `invoices` por dentro, e se
-- rodasse com os poderes do chamador a política de `payments` consultaria
-- `invoices`, cuja política consultaria de volta — foi exatamente a recursão
-- infinita que estourou em announcements (ver announcements_rls). Definer corta o ciclo.
create or replace function can_view_invoice(p_invoice uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from invoices i
     where i.id = p_invoice
       and (
         is_staff(i.organization_id)
         or i.athlete_id in (select auth_athlete_ids())
         or (
           i.household_id is not null
           and i.household_id in (
             select g.household_id from guardians g
              where g.user_id = auth.uid() and g.household_id is not null
           )
         )
       )
  )
$$;

-- A faxina do grant implícito a `public`/`anon` está na billing_lock_definer_execute.
grant execute on function can_view_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

create policy invoices_admin_all on invoices
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy invoices_staff_read on invoices
  for select using (is_staff(organization_id));

create policy invoices_family_read on invoices
  for select using (can_view_invoice(id));

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create policy payments_admin_all on payments
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy payments_staff_read on payments
  for select using (is_staff(organization_id));

create policy payments_family_read on payments
  for select using (can_view_invoice(invoice_id));

-- ---------------------------------------------------------------------------
-- refunds
-- ---------------------------------------------------------------------------

create policy refunds_admin_all on refunds
  for all using (has_org_role(organization_id, array['owner','admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin']::org_role[]));

create policy refunds_staff_read on refunds
  for select using (is_staff(organization_id));

-- A família precisa ver o próprio estorno (o dinheiro voltou ou não?).
create policy refunds_family_read on refunds
  for select using (
    exists (
      select 1 from payments p
       where p.id = refunds.payment_id and can_view_invoice(p.invoice_id)
    )
  );
