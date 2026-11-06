import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePeriod, todayInTimeZone, type DayValue, type Period, type PeriodKey } from '@ca-tempo/domain';
import { createClient } from '@/lib/supabase/server';

export type KeyValue = { key: string | null; value: number };

export type OpenInvoice = {
  id: string;
  number: string;
  athlete: string;
  due_on: string | null;
  created_at: string;
  balance_cents: number;
  pending_cents: number;
};

export type FinanceData = {
  received_cents: number;
  prev_received_cents: number;
  payment_count: number;
  prev_payment_count: number;
  refunded_cents: number;
  fee_cents: number;
  invoiced_cents: number;
  prev_invoiced_cents: number;
  invoice_count: number;
  collected_of_invoiced_cents: number;
  discount_cents: number;
  daily: DayValue[];
  by_method: KeyValue[];
  by_program: KeyValue[];
  monthly: { month: string; value: number }[];
  open_invoices: OpenInvoice[];
  recent_payments: { id: string; athlete: string; cents: number; method: string; paid_at: string }[];
  uninvoiced_count: number;
  expiring_holds: number;
  failed_emails: number;
  paid_forms_closed: number;
};

export type OperationsData = {
  registrations: number;
  prev_registrations: number;
  pending_registrations: number;
  waitlisted: number;
  funnel: { received: number; approved: number; invoiced: number; paid: number };
  registrations_daily: DayValue[];
  by_program: KeyValue[];
  active_athletes: number;
  families: number;
  new_athletes: number;
  prev_new_athletes: number;
  birth_years: { year: number; value: number }[];
  sessions_held: number;
  prev_sessions_held: number;
  minutes_trained: number;
  sessions_canceled: number;
  attended: number;
  missed: number;
  prev_attended: number;
  prev_missed: number;
  rsvp_answered: number;
  rsvp_total: number;
  attendance_daily: DayValue[];
  weekdays: { dow: number; value: number }[];
  activity: DayValue[];
  missing_athletes: { id: string; name: string; last_seen: string; days: number }[];
  birthdays: { id: string; name: string; date: string; age: number }[];
  groups: { id: string; name: string; members: number; capacity: number; waitlist: number }[];
  programs: { id: string; name: string; taken: number; capacity: number }[];
  recent_registrations: {
    id: string;
    athlete: string;
    program: string | null;
    status: string;
    created_at: string;
  }[];
};

export type LibraryUsage = { used_bytes: number; quota_bytes: number; max_file_bytes: number };

export type DashboardData = {
  today: string;
  period: Period;
  currency: string;
  finance: FinanceData | null;
  operations: OperationsData;
  library: LibraryUsage | null;
};

/**
 * Dinheiro só é pedido para quem pode ver. A função no banco recusa de
 * qualquer jeito: esse `canSeeMoney` só evita uma chamada que daria erro.
 */
export async function loadDashboard(
  orgId: string,
  periodKey: PeriodKey,
  canSeeMoney: boolean,
): Promise<DashboardData> {
  const db = (await createClient()) as unknown as SupabaseClient;

  const { data: org } = await db
    .from('organizations')
    .select('timezone, currency')
    .eq('id', orgId)
    .single();

  const settings = org as { timezone: string; currency: string } | null;
  const today = todayInTimeZone(settings?.timezone ?? 'America/New_York');
  const period = resolvePeriod(periodKey, today);

  const range = {
    p_org: orgId,
    p_from: period.from,
    p_to: period.to,
    p_prev_from: period.prevFrom,
    p_prev_to: period.prevTo,
  };

  const [finance, operations, library] = await Promise.all([
    canSeeMoney ? db.rpc('dashboard_finance', range) : Promise.resolve({ data: null, error: null }),
    db.rpc('dashboard_operations', range),
    db.rpc('library_usage', { p_org: orgId }),
  ]);

  if (finance.error) throw new Error(finance.error.message);
  if (operations.error) throw new Error(operations.error.message);

  return {
    today,
    period,
    currency: settings?.currency ?? 'usd',
    finance: finance.data as FinanceData | null,
    operations: operations.data as OperationsData,
    library: library.data as LibraryUsage | null,
  };
}
