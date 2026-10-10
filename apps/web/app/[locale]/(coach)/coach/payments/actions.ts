'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseStatement,
  matchStatement,
  summarizeMatches,
  type StatementMatch,
  type MatchSummary,
  type OpenInvoice,
} from '@ca-tempo/domain';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import {
  enqueueInvoiceCreated,
  enqueuePaymentReceived,
  enqueueInvoiceReminder,
} from '@/lib/notifications/enqueue';
import { flushNotificationsAfterResponse } from '@/lib/notifications/dispatch';

export type ActionResult = { ok: true; count: number } | { ok: false; error: string };

export type PendingInvoice = {
  id: string;
  number: string;
  athleteName: string;
  memo: string | null;
  totalCents: number;
  dueCents: number;
  dueOn: string | null;
  createdAt: string;
  /** Pagamento em compensação (ACH): não pode receber baixa manual agora. */
  hasPending: boolean;
};

/** Métodos que a baixa manual aceita. Gateway entra pelo webhook, não aqui. */
const OFFLINE_METHODS = ['venmo', 'cash', 'check', 'zelle', 'account_credit', 'other'] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];

function isOfflineMethod(value: string): value is OfflineMethod {
  return (OFFLINE_METHODS as readonly string[]).includes(value);
}

export async function listPendingInvoices(): Promise<PendingInvoice[]> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = (await createClient()) as unknown as SupabaseClient;

  // RLS já limita à organização; o filtro explícito evita trazer o que a
  // policy descartaria depois.
  const { data } = await db
    .from('invoices')
    .select('id, number, memo, total_cents, due_on, created_at, athletes(first_name, last_name)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  const invoices = data ?? [];
  if (invoices.length === 0) return [];

  const { data: balances } = await db
    .from('invoice_balances')
    .select('invoice_id, balance_cents, pending_cents')
    .in(
      'invoice_id',
      invoices.map((i) => i.id as string),
    );

  const byId = new Map(
    (balances ?? []).map((b) => [
      b.invoice_id as string,
      { due: b.balance_cents as number, pending: b.pending_cents as number },
    ]),
  );

  return invoices.map((invoice) => {
    const athlete = invoice.athletes as { first_name?: string; last_name?: string } | null;
    const balance = byId.get(invoice.id as string);

    return {
      id: invoice.id as string,
      number: invoice.number as string,
      athleteName: athlete
        ? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim()
        : '—',
      memo: (invoice.memo as string | null) ?? null,
      totalCents: invoice.total_cents as number,
      dueCents: balance?.due ?? (invoice.total_cents as number),
      dueOn: (invoice.due_on as string | null) ?? null,
      createdAt: invoice.created_at as string,
      hasPending: (balance?.pending ?? 0) > 0,
    };
  });
}

/**
 * Dá baixa manual em várias faturas de uma vez.
 *
 * Vai por RPC em lote (uma transação) em vez de um laço de chamadas: com 70
 * pagamentos numa semana de camp, uma falha no meio deixaria metade lançada
 * e ninguém saberia onde parou.
 */
export async function markPaidBulk(
  invoiceIds: string[],
  method: string,
  reference?: string,
): Promise<ActionResult> {
  await requireRole(['owner', 'admin', 'coach', 'staff']);

  if (invoiceIds.length === 0) return { ok: false, error: 'empty' };
  if (!isOfflineMethod(method)) return { ok: false, error: 'invalid_method' };

  const db = (await createClient()) as unknown as SupabaseClient;

  // Cliente do USUÁRIO, não service role: a RPC lê auth.uid() para checar a
  // permissão na organização e para gravar quem deu a baixa. Com service
  // role o auth.uid() seria nulo e a baixa ficaria sem dono.
  const { data, error } = await db.rpc('record_offline_payments_bulk', {
    p_invoice_ids: invoiceIds,
    p_method: method,
    p_references: reference ? invoiceIds.map(() => reference) : null,
  });

  if (error) return { ok: false, error: error.message };

  await enqueueReceiptsFor(db, invoiceIds);

  flushNotificationsAfterResponse();
  revalidatePath('/[locale]/coach/payments', 'page');
  return { ok: true, count: (data as number | null) ?? 0 };
}

/**
 * Enfileira o recibo dos pagamentos offline recém-lançados.
 *
 * A RPC em lote devolve só a contagem, não os ids. Em vez de mudar a
 * assinatura dela, procuramos aqui o último pagamento offline de cada
 * fatura. A chave de deduplicação da caixa de saída garante que o mesmo
 * pagamento não gere dois recibos, então reprocessar é inofensivo.
 */
async function enqueueReceiptsFor(db: SupabaseClient, invoiceIds: string[]): Promise<void> {
  if (invoiceIds.length === 0) return;

  const { data } = await db
    .from('payments')
    .select('id, invoice_id, created_at')
    .in('invoice_id', invoiceIds)
    .eq('provider', 'offline')
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false });

  const maisRecentePorFatura = new Map<string, string>();
  for (const row of data ?? []) {
    const invoice = row.invoice_id as string;
    if (!maisRecentePorFatura.has(invoice)) {
      maisRecentePorFatura.set(invoice, row.id as string);
    }
  }

  // Em série, não em paralelo: um lote de semana de camp pode ter 70 faturas,
  // e 70 chamadas simultâneas por causa de recibo não vale o risco numa
  // operação que é secundária à baixa em si.
  for (const paymentId of maisRecentePorFatura.values()) {
    await enqueuePaymentReceived(paymentId);
  }
}

// ---------------------------------------------------------------------------
// Importação do extrato
// ---------------------------------------------------------------------------

export type StatementPreview =
  | {
      ok: true;
      matches: StatementMatch[];
      summary: MatchSummary;
      skipped: number;
    }
  | { ok: false; error: 'no_header' | 'missing_columns' | 'empty' };

/**
 * Lê o CSV do extrato e mostra o que casou, SEM escrever nada.
 *
 * Separar leitura de escrita é deliberado: a pessoa vê a lista, confere e só
 * então confirma. Importar direto seria rápido e, no primeiro arquivo de
 * formato inesperado, desastroso.
 */
export async function previewStatement(csvText: string): Promise<StatementPreview> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);

  if (!csvText.trim()) return { ok: false, error: 'empty' };

  const parsed = parseStatement(csvText);
  if (parsed.error) return { ok: false, error: parsed.error as 'no_header' | 'missing_columns' };

  const db = (await createClient()) as unknown as SupabaseClient;

  const { data: invoices } = await db
    .from('invoices')
    .select('id, number, athletes(first_name)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'open');

  const ids = (invoices ?? []).map((i) => i.id as string);
  const { data: balances } = await db
    .from('invoice_balances')
    .select('invoice_id, balance_cents')
    .in('invoice_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

  const dueById = new Map(
    (balances ?? []).map((b) => [b.invoice_id as string, b.balance_cents as number]),
  );

  const open: OpenInvoice[] = (invoices ?? []).map((invoice) => ({
    id: invoice.id as string,
    number: invoice.number as string,
    athleteName:
      (invoice.athletes as { first_name?: string } | null)?.first_name ?? null,
    dueCents: dueById.get(invoice.id as string) ?? 0,
  }));

  const matches = matchStatement(parsed.rows, open);

  return { ok: true, matches, summary: summarizeMatches(matches), skipped: parsed.skipped };
}

/** Confirma a importação, lançando só o que a pessoa deixou marcado. */
export async function confirmStatementImport(
  items: { invoiceId: string; reference: string }[],
): Promise<ActionResult> {
  await requireRole(['owner', 'admin', 'coach', 'staff']);

  if (items.length === 0) return { ok: false, error: 'empty' };

  const db = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await db.rpc('record_offline_payments_bulk', {
    p_invoice_ids: items.map((i) => i.invoiceId),
    p_method: 'venmo',
    p_references: items.map((i) => i.reference),
  });

  if (error) return { ok: false, error: error.message };

  await enqueueReceiptsFor(db, items.map((i) => i.invoiceId));

  flushNotificationsAfterResponse();
  revalidatePath('/[locale]/coach/payments', 'page');
  return { ok: true, count: (data as number | null) ?? 0 };
}

// ---------------------------------------------------------------------------
// Emissão de fatura a partir da inscrição
// ---------------------------------------------------------------------------

export type UninvoicedRegistration = {
  id: string;
  athleteName: string;
  programName: string | null;
  optionName: string | null;
  priceCents: number | null;
  createdAt: string;
  status: string;
};

/**
 * Inscrições que ainda não têm fatura.
 *
 * É a fila de trabalho do admin: inscrição aprovada sem fatura é dinheiro
 * que ninguém pediu. Fica aqui, e não escondida na tela de inscrições,
 * porque o assunto é cobrança.
 */
export async function listUninvoicedRegistrations(): Promise<UninvoicedRegistration[]> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = (await createClient()) as unknown as SupabaseClient;

  const { data } = await db
    .from('registrations')
    .select(
      'id, status, created_at, athletes(first_name, last_name), programs(name), program_options(name, price_cents)',
    )
    .eq('organization_id', ctx.orgId)
    .is('invoice_id', null)
    .is('canceled_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  return (data ?? []).map((row) => {
    const athlete = row.athletes as { first_name?: string; last_name?: string } | null;
    const option = row.program_options as { name?: string; price_cents?: number } | null;

    return {
      id: row.id as string,
      athleteName: athlete
        ? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim()
        : '—',
      programName: (row.programs as { name?: string } | null)?.name ?? null,
      optionName: option?.name ?? null,
      priceCents: option?.price_cents ?? null,
      createdAt: row.created_at as string,
      status: row.status as string,
    };
  });
}

export type CreateInvoiceResult = { ok: true; invoiceId: string } | { ok: false; error: string };

/** Emite a fatura de uma inscrição. Idempotente: a RPC devolve a existente. */
export async function createInvoiceFor(
  registrationId: string,
  dueOn?: string | null,
): Promise<CreateInvoiceResult> {
  await requireRole(['owner', 'admin', 'coach', 'staff']);

  const db = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await db.rpc('create_invoice_for_registration', {
    p_registration_id: registrationId,
    p_discount_cents: 0,
    p_discount_reason: null,
    p_due_on: dueOn || null,
    p_memo: null,
  });

  if (error) return { ok: false, error: error.message };

  // Emitir sem avisar é cobrar no escuro: a fatura passa a existir e a
  // família não fica sabendo. Enfileirar não derruba a emissão se falhar.
  await enqueueInvoiceCreated(data as string);

  flushNotificationsAfterResponse();
  revalidatePath('/[locale]/coach/payments', 'page');
  return { ok: true, invoiceId: data as string };
}

// ---------------------------------------------------------------------------
// Configuração de pagamento da organização
// ---------------------------------------------------------------------------

export type PaymentSettings = {
  venmoHandle: string;
  offlineNote: string;
  coachCanRecord: boolean;
  reservationMode: 'none' | 'timed' | 'unlimited';
  reservationHours: number;
};

const SETTING_KEYS = {
  offline: 'payments.offline',
  coach: 'payments.coach_can_record',
  reservation: 'payments.reservation',
} as const;

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = (await createClient()) as unknown as SupabaseClient;

  const { data } = await db
    .from('org_settings')
    .select('key, value')
    .eq('organization_id', ctx.orgId)
    .in('key', Object.values(SETTING_KEYS));

  const byKey = new Map((data ?? []).map((row) => [row.key as string, row.value]));

  const offline = (byKey.get(SETTING_KEYS.offline) ?? {}) as {
    venmo_handle?: string;
    note?: string;
  };
  const reservation = (byKey.get(SETTING_KEYS.reservation) ?? {}) as {
    mode?: string;
    hours?: number;
  };

  return {
    venmoHandle: offline.venmo_handle ?? '',
    offlineNote: offline.note ?? '',
    coachCanRecord: byKey.get(SETTING_KEYS.coach) === true,
    reservationMode:
      reservation.mode === 'none' || reservation.mode === 'unlimited'
        ? reservation.mode
        : 'timed',
    reservationHours: typeof reservation.hours === 'number' ? reservation.hours : 72,
  };
}

export async function savePaymentSettings(
  settings: PaymentSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Só dono e admin: quem pode dar baixa e por quanto tempo a vaga fica
  // presa são decisões de quem responde pelo dinheiro, não de quem treina.
  const ctx = await requireRole(['owner', 'admin']);
  const db = (await createClient()) as unknown as SupabaseClient;

  const handle = settings.venmoHandle.trim();
  const hours = Number.isFinite(settings.reservationHours)
    ? Math.min(Math.max(Math.round(settings.reservationHours), 1), 24 * 60)
    : 72;

  const rows = [
    {
      organization_id: ctx.orgId,
      key: SETTING_KEYS.offline,
      value: {
        venmo_handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
        note: settings.offlineNote.trim(),
      },
    },
    {
      organization_id: ctx.orgId,
      key: SETTING_KEYS.coach,
      value: settings.coachCanRecord,
    },
    {
      organization_id: ctx.orgId,
      key: SETTING_KEYS.reservation,
      value:
        settings.reservationMode === 'timed'
          ? { mode: 'timed', hours }
          : { mode: settings.reservationMode },
    },
  ];

  const { error } = await db
    .from('org_settings')
    .upsert(rows, { onConflict: 'organization_id,key' });

  if (error) return { ok: false, error: error.message };

  flushNotificationsAfterResponse();
  revalidatePath('/[locale]/coach/payments', 'page');
  revalidatePath('/[locale]/coach/payments/settings', 'page');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Caixa de saída de notificações
// ---------------------------------------------------------------------------

export type NotificationQueue = {
  /** A conta de e-mail já está configurada? */
  configured: boolean;
  missing: string[];
  pending: number;
  sent: number;
  failed: number;
  /** As últimas da fila, para o admin ver o que está parado. */
  recent: {
    id: string;
    type: string;
    recipient: string;
    subject: string;
    status: string;
    error: string | null;
    createdAt: string;
  }[];
};

export async function getNotificationQueue(): Promise<NotificationQueue> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = (await createClient()) as unknown as SupabaseClient;

  const { data } = await db
    .from('notifications')
    .select('id, type, recipient, subject, status, error, created_at')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = data ?? [];

  const counts = { pending: 0, sent: 0, failed: 0 };
  for (const row of rows) {
    const status = row.status as string;
    if (status === 'pending') counts.pending += 1;
    else if (status === 'sent') counts.sent += 1;
    else if (status === 'failed') counts.failed += 1;
  }

  // A contagem de pendentes vem de query própria: a lista está limitada a 20
  // e, se houver 300 presas, mostrar "20" seria mentira tranquilizadora.
  const { count: pendingTotal } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('status', 'pending');

  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATIONS_FROM_EMAIL),
    missing: [
      process.env.RESEND_API_KEY ? null : 'RESEND_API_KEY',
      process.env.NOTIFICATIONS_FROM_EMAIL ? null : 'NOTIFICATIONS_FROM_EMAIL',
    ].filter((v): v is string => v !== null),
    pending: pendingTotal ?? counts.pending,
    sent: counts.sent,
    failed: counts.failed,
    recent: rows.map((row) => ({
      id: row.id as string,
      type: row.type as string,
      recipient: row.recipient as string,
      subject: row.subject as string,
      status: row.status as string,
      error: (row.error as string | null) ?? null,
      createdAt: row.created_at as string,
    })),
  };
}

/**
 * Enfileira lembrete para as faturas vencidas da organização.
 *
 * A chave de deduplicação limita a um por fatura por dia, então clicar duas
 * vezes não manda dois e-mails. Faturas com pagamento em compensação são
 * puladas dentro do `enqueueInvoiceReminder`.
 */
export async function sendOverdueReminders(): Promise<ActionResult> {
  await requireRole(['owner', 'admin']);

  const invoices = await listPendingInvoices();
  const hoje = Date.now();

  const vencidas = invoices.filter((invoice) => {
    if (invoice.hasPending) return false;
    const referencia = invoice.dueOn ?? invoice.createdAt;
    return new Date(referencia).getTime() < hoje;
  });

  let count = 0;
  for (const invoice of vencidas) {
    if (await enqueueInvoiceReminder(invoice.id)) count += 1;
  }

  flushNotificationsAfterResponse();
  revalidatePath('/[locale]/coach/payments', 'page');
  return { ok: true, count };
}
