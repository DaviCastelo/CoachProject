/**
 * Regras de fatura e de reserva de vaga.
 *
 * Tudo aqui é puro: recebe números e devolve números. O saldo real vem da view
 * `invoice_balances` no banco, que soma os pagamentos em vez de guardar um
 * campo denormalizado que diverge.
 */

export const INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'void',
  'refunded',
  'uncollectible',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Estados em que a fatura saiu do fluxo: não contam em inadimplência. */
const TERMINAL_STATUSES: readonly InvoiceStatus[] = ['void', 'refunded', 'uncollectible'];

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

/**
 * Status derivado do que foi efetivamente pago.
 *
 * `void`, `refunded` e `uncollectible` são decisões humanas e não voltam
 * atrás sozinhas — por isso são preservadas. `draft` também: enquanto a
 * fatura não foi aberta, ninguém devia estar pagando.
 */
export function deriveInvoiceStatus(params: {
  current: InvoiceStatus;
  totalCents: number;
  paidCents: number;
}): InvoiceStatus {
  const { current, totalCents, paidCents } = params;

  if (TERMINAL_STATUSES.includes(current)) return current;
  if (current === 'draft') return 'draft';

  return paidCents >= totalCents ? 'paid' : 'open';
}

/** Quanto falta pagar. Nunca negativo: pagamento a mais vira crédito, não dívida negativa. */
export function balanceCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents);
}

/** Pagou mais do que devia? O excedente vira crédito em conta. */
export function overpaymentCents(totalCents: number, paidCents: number): number {
  return Math.max(0, paidCents - totalCents);
}

/**
 * Está em atraso? Fatura sem vencimento nunca atrasa, e fatura quitada ou
 * encerrada também não.
 */
export function isOverdue(params: {
  status: InvoiceStatus;
  dueOn: string | Date | null;
  totalCents: number;
  paidCents: number;
  now?: Date;
}): boolean {
  const { status, dueOn, totalCents, paidCents, now = new Date() } = params;

  if (dueOn === null) return false;
  if (status === 'paid' || TERMINAL_STATUSES.includes(status)) return false;
  if (paidCents >= totalCents) return false;

  const due = dueOn instanceof Date ? dueOn : new Date(dueOn);
  if (Number.isNaN(due.getTime())) return false;

  return due.getTime() < now.getTime();
}

// ---------------------------------------------------------------------------
// Reserva de vaga
// ---------------------------------------------------------------------------

/**
 * O que acontece com a vaga enquanto a inscrição não foi paga. Guardado em
 * `org_settings` sob a chave `payments.reservation`.
 *
 * O dilema é real nos dois extremos: com `none`, a família paga e pode
 * descobrir que a turma lotou; com `unlimited`, alguém trava uma vaga e nunca
 * paga. `timed` resolve os dois, e é o que a maioria dos clubes faz.
 */
export type ReservationPolicy =
  | { mode: 'none' }
  | { mode: 'timed'; hours: number }
  | { mode: 'unlimited' };

export const DEFAULT_RESERVATION_POLICY: ReservationPolicy = { mode: 'timed', hours: 72 };

/** Lê a política do jsonb de org_settings, caindo no padrão quando malformada. */
export function parseReservationPolicy(raw: unknown): ReservationPolicy {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_RESERVATION_POLICY;

  const mode = (raw as { mode?: unknown }).mode;
  if (mode === 'none') return { mode: 'none' };
  if (mode === 'unlimited') return { mode: 'unlimited' };

  if (mode === 'timed') {
    const hours = (raw as { hours?: unknown }).hours;
    if (typeof hours === 'number' && Number.isFinite(hours) && hours > 0) {
      return { mode: 'timed', hours };
    }
    return DEFAULT_RESERVATION_POLICY;
  }

  return DEFAULT_RESERVATION_POLICY;
}

/**
 * Até quando a vaga fica segura. `null` significa duas coisas diferentes
 * conforme a política, e é por isso que `holdsSpot` existe separada:
 * em `none` não há reserva nenhuma; em `unlimited` a reserva não expira.
 */
export function reservedUntil(
  policy: ReservationPolicy,
  from: Date = new Date(),
): Date | null {
  if (policy.mode === 'timed') {
    return new Date(from.getTime() + policy.hours * 60 * 60 * 1000);
  }
  return null;
}

/** A inscrição não paga está segurando a vaga neste instante? */
export function holdsSpot(params: {
  policy: ReservationPolicy;
  reservedUntil: string | Date | null;
  now?: Date;
}): boolean {
  const { policy, now = new Date() } = params;

  if (policy.mode === 'none') return false;
  if (policy.mode === 'unlimited') return true;

  if (params.reservedUntil === null) return false;
  const until =
    params.reservedUntil instanceof Date
      ? params.reservedUntil
      : new Date(params.reservedUntil);
  if (Number.isNaN(until.getTime())) return false;

  return until.getTime() > now.getTime();
}
