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

  revalidatePath('/coach/payments');
  return { ok: true, count: (data as number | null) ?? 0 };
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

  revalidatePath('/coach/payments');
  return { ok: true, count: (data as number | null) ?? 0 };
}
