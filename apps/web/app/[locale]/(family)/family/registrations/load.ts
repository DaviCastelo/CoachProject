import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  resolveFamilyRegistrationState,
  type BalanceSnapshot,
  type FamilyRegistrationState,
  type InvoiceSnapshot,
  type InvoiceStatus,
  type RegistrationStatus,
} from '@/lib/family/registration-state';

export type FamilyRegistrationItem = FamilyRegistrationState & {
  id: string;
  programName: string | null;
  optionName: string | null;
  memo: string | null;
  athleteName: string;
  createdAt: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  currency: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  total_cents: number;
  due_on: string | null;
  memo: string | null;
};

type RegistrationRow = {
  id: string;
  status: RegistrationStatus;
  created_at: string;
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  programs: { name: string } | { name: string }[] | null;
  program_options:
    | { name: string; price_cents: number }
    | { name: string; price_cents: number }[]
    | null;
  invoices: InvoiceRow | InvoiceRow[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Inscrições que a pessoa logada pode ver.
 *
 * A RLS já limita ao atleta (ou aos atletas do responsável). Duas leituras
 * porque `invoice_balances` é view e não entra no embed da inscrição.
 */
export async function listFamilyRegistrations(): Promise<FamilyRegistrationItem[]> {
  const db = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data } = await db
    .from('registrations')
    .select(
      'id, status, created_at, athletes(first_name, last_name), programs(name), program_options(name, price_cents), invoices!registrations_invoice_id_fkey(id, number, status, currency, total_cents, due_on, memo)',
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as RegistrationRow[];
  const invoiceIds = rows
    .map((row) => one(row.invoices)?.id)
    .filter((id): id is string => Boolean(id));

  const balances = new Map<string, BalanceSnapshot>();
  if (invoiceIds.length > 0) {
    const { data: balanceRows } = await db
      .from('invoice_balances')
      .select('invoice_id, paid_cents, pending_cents, balance_cents')
      .in('invoice_id', invoiceIds);

    for (const row of (balanceRows ?? []) as {
      invoice_id: string | null;
      paid_cents: number | null;
      pending_cents: number | null;
      balance_cents: number | null;
    }[]) {
      if (!row.invoice_id) continue;
      balances.set(row.invoice_id, {
        paidCents: row.paid_cents ?? 0,
        pendingCents: row.pending_cents ?? 0,
        balanceCents: row.balance_cents ?? 0,
      });
    }
  }

  return rows.map((row) => {
    const athlete = one(row.athletes);
    const program = one(row.programs);
    const option = one(row.program_options);
    const invoice = one(row.invoices);
    const snapshot: InvoiceSnapshot | null = invoice
      ? { status: invoice.status, totalCents: invoice.total_cents, dueOn: invoice.due_on }
      : null;
    const state = resolveFamilyRegistrationState(
      { status: row.status, optionPriceCents: option?.price_cents ?? null },
      snapshot,
      invoice ? (balances.get(invoice.id) ?? null) : null,
    );

    return {
      id: row.id,
      programName: program?.name ?? null,
      optionName: option?.name ?? null,
      memo: invoice?.memo ?? null,
      athleteName: athlete ? `${athlete.first_name} ${athlete.last_name}`.trim() : '',
      createdAt: row.created_at,
      invoiceId: state.canPay && invoice ? invoice.id : null,
      invoiceNumber: invoice && invoice.status !== 'draft' ? invoice.number : null,
      currency: invoice?.currency ?? 'usd',
      ...state,
    };
  });
}
