import type { SupabaseClient } from '@supabase/supabase-js';
import {
  renderInvoiceCreated,
  renderPaymentReceived,
  renderInvoiceReminder,
  resolveTemplateLocale,
  dedupeKey,
  daysOverdue,
} from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoney } from '@/lib/format-money';
import { formatDate } from '@/lib/format-datetime';

/**
 * Enfileira as mensagens de cobrança na caixa de saída.
 *
 * Nada aqui envia nada: só grava a intenção, com destinatário, assunto e
 * corpo prontos. O envio é do `dispatch`, que depende da conta Resend.
 *
 * Separar as duas coisas é o que permite o sistema já estar correto hoje e a
 * chave da Resend ser só a última milha. Também é o que garante que nenhuma
 * cobrança se perde se o provedor estiver fora do ar.
 *
 * Toda função aqui é tolerante a falha de propósito: notificação é
 * consequência da operação, não requisito dela. Se enfileirar falhar, a
 * fatura continua emitida e o pagamento continua registrado.
 */

type InvoiceRow = {
  id: string;
  organization_id: string;
  number: string;
  currency: string;
  total_cents: number;
  due_on: string | null;
  memo: string | null;
  athletes: { first_name: string | null; last_name: string | null } | null;
  organizations: { name: string | null } | null;
};

const INVOICE_SELECT =
  'id, organization_id, number, currency, total_cents, due_on, memo, athletes(first_name, last_name), organizations(name)';

async function billingContact(
  db: SupabaseClient,
  invoiceId: string,
): Promise<{ email: string; name: string | null; locale: string } | null> {
  const { data } = await db.rpc('invoice_billing_contact', { p_invoice_id: invoiceId });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.email) return null;
  return { email: row.email as string, name: row.name as string | null, locale: row.locale as string };
}

function athleteName(invoice: InvoiceRow): string {
  const a = invoice.athletes;
  if (!a) return '';
  return `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim();
}

function payUrl(invoiceId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}/pay/${invoiceId}`;
}

/** Avisa a família que a fatura saiu, com o link de pagamento. */
export async function enqueueInvoiceCreated(invoiceId: string): Promise<void> {
  try {
    const db = createServiceClient() as unknown as SupabaseClient;

    const { data: invoice } = await db
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('id', invoiceId)
      .maybeSingle<InvoiceRow>();

    if (!invoice) return;

    const contact = await billingContact(db, invoiceId);
    if (!contact) return; // sem endereço: nada a enfileirar

    const locale = resolveTemplateLocale(contact.locale);
    const message = renderInvoiceCreated(locale, {
      orgName: invoice.organizations?.name ?? 'CA Tempo',
      recipientName: contact.name,
      athleteName: athleteName(invoice),
      invoiceNumber: invoice.number,
      amount: formatMoney(invoice.total_cents, locale, invoice.currency),
      dueDate: invoice.due_on ? formatDate(invoice.due_on, locale) : null,
      payUrl: payUrl(invoiceId),
      memo: invoice.memo,
    });

    await db.rpc('enqueue_notification', {
      p_organization_id: invoice.organization_id,
      p_type: 'invoice_created',
      p_recipient: contact.email,
      p_subject: message.subject,
      p_body: message.body,
      p_dedupe_key: dedupeKey('invoice_created', invoiceId),
      p_recipient_name: contact.name,
      p_payload: { action_url: payUrl(invoiceId), locale },
      p_invoice_id: invoiceId,
      p_payment_id: null,
    });
  } catch (error) {
    console.error('[notifications] falha ao enfileirar invoice_created', invoiceId, error);
  }
}

/** Recibo. Diz se quitou ou quanto ainda falta. */
export async function enqueuePaymentReceived(paymentId: string): Promise<void> {
  try {
    const db = createServiceClient() as unknown as SupabaseClient;

    const { data: payment } = await db
      .from('payments')
      .select('id, invoice_id, organization_id, amount_cents, method, status')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment || payment.status !== 'succeeded') return;

    const { data: invoice } = await db
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('id', payment.invoice_id as string)
      .maybeSingle<InvoiceRow>();

    if (!invoice) return;

    const contact = await billingContact(db, invoice.id);
    if (!contact) return;

    const { data: balance } = await db
      .from('invoice_balances')
      .select('balance_cents')
      .eq('invoice_id', invoice.id)
      .maybeSingle();

    const remaining = (balance?.balance_cents as number | undefined) ?? 0;
    const locale = resolveTemplateLocale(contact.locale);

    const message = renderPaymentReceived(locale, {
      orgName: invoice.organizations?.name ?? 'CA Tempo',
      recipientName: contact.name,
      athleteName: athleteName(invoice),
      invoiceNumber: invoice.number,
      amount: formatMoney(payment.amount_cents as number, locale, invoice.currency),
      method: payment.method as string,
      remaining: remaining > 0 ? formatMoney(remaining, locale, invoice.currency) : null,
    });

    await db.rpc('enqueue_notification', {
      p_organization_id: payment.organization_id as string,
      p_type: 'payment_received',
      p_recipient: contact.email,
      p_subject: message.subject,
      p_body: message.body,
      p_dedupe_key: dedupeKey('payment_received', paymentId),
      p_recipient_name: contact.name,
      p_payload: { locale },
      p_invoice_id: invoice.id,
      p_payment_id: paymentId,
    });
  } catch (error) {
    console.error('[notifications] falha ao enfileirar payment_received', paymentId, error);
  }
}

/**
 * Lembrete de fatura em aberto. No máximo um por fatura por dia, garantido
 * pela chave de deduplicação — então pode ser chamado à vontade.
 */
export async function enqueueInvoiceReminder(invoiceId: string): Promise<boolean> {
  try {
    const db = createServiceClient() as unknown as SupabaseClient;

    const { data: invoice } = await db
      .from('invoices')
      .select(`${INVOICE_SELECT}, created_at, status`)
      .eq('id', invoiceId)
      .maybeSingle<InvoiceRow & { created_at: string; status: string }>();

    if (!invoice || invoice.status !== 'open') return false;

    // Pagamento em compensação (ACH leva dias): cobrar quem já pagou é o
    // jeito mais rápido de perder a confiança da família.
    const { data: balance } = await db
      .from('invoice_balances')
      .select('balance_cents, pending_cents')
      .eq('invoice_id', invoiceId)
      .maybeSingle();

    if ((balance?.pending_cents ?? 0) > 0) return false;

    const due = (balance?.balance_cents as number | undefined) ?? invoice.total_cents;
    if (due <= 0) return false;

    const contact = await billingContact(db, invoiceId);
    if (!contact) return false;

    const locale = resolveTemplateLocale(contact.locale);
    const message = renderInvoiceReminder(locale, {
      orgName: invoice.organizations?.name ?? 'CA Tempo',
      recipientName: contact.name,
      athleteName: athleteName(invoice),
      invoiceNumber: invoice.number,
      amount: formatMoney(due, locale, invoice.currency),
      dueDate: invoice.due_on ? formatDate(invoice.due_on, locale) : null,
      payUrl: payUrl(invoiceId),
      memo: invoice.memo,
      daysOverdue: daysOverdue({ dueOn: invoice.due_on, createdAt: invoice.created_at }),
    });

    const { data } = await db.rpc('enqueue_notification', {
      p_organization_id: invoice.organization_id,
      p_type: 'invoice_reminder',
      p_recipient: contact.email,
      p_subject: message.subject,
      p_body: message.body,
      p_dedupe_key: dedupeKey('invoice_reminder', invoiceId),
      p_recipient_name: contact.name,
      p_payload: { action_url: payUrl(invoiceId), locale },
      p_invoice_id: invoiceId,
      p_payment_id: null,
    });

    return data !== null;
  } catch (error) {
    console.error('[notifications] falha ao enfileirar invoice_reminder', invoiceId, error);
    return false;
  }
}
