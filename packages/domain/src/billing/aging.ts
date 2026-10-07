/**
 * Envelhecimento de faturas em aberto (relatório de inadimplência).
 *
 * A pergunta que o cliente precisa responder antes de um camp começar é
 * simples: quem ainda não pagou e há quanto tempo. Uma lista plana não
 * responde isso — $8.000 em aberto pode ser tudo de ontem ou tudo de três
 * meses atrás, e são situações completamente diferentes.
 */

export const AGING_BUCKETS = ['current', 'd1_7', 'd8_30', 'd31_plus'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

const DAY_MS = 86_400_000;

/**
 * Dias de atraso. Negativo quando ainda não venceu.
 *
 * Sem vencimento definido, a contagem é a partir da emissão: uma fatura sem
 * prazo não é uma fatura sem cobrança, e deixá-la fora do relatório é como
 * ela deixar de existir.
 */
export function daysOverdue(
  input: { dueOn: string | Date | null; createdAt: string | Date },
  now: Date = new Date(),
): number {
  const reference = input.dueOn ?? input.createdAt;
  const date = reference instanceof Date ? reference : parseDate(reference);
  if (date === null) return 0;

  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

/**
 * Data-only (`YYYY-MM-DD`) vira meia-noite LOCAL, não UTC: `due_on` é uma
 * data, não um instante, e tratá-la como UTC desloca o dia em fuso negativo.
 * Mesmo motivo de `toDate` em apps/web/lib/format-datetime.
 */
function parseDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function agingBucket(
  input: { dueOn: string | Date | null; createdAt: string | Date },
  now: Date = new Date(),
): AgingBucket {
  const days = daysOverdue(input, now);
  if (days <= 0) return 'current';
  if (days <= 7) return 'd1_7';
  if (days <= 30) return 'd8_30';
  return 'd31_plus';
}

export type AgingInput = {
  dueOn: string | Date | null;
  createdAt: string | Date;
  dueCents: number;
};

export type AgingReport = {
  buckets: Record<AgingBucket, { count: number; cents: number }>;
  totalCount: number;
  totalCents: number;
  /** Só o que já passou do prazo: é este número que preocupa. */
  overdueCount: number;
  overdueCents: number;
};

export function summarizeAging(
  invoices: readonly AgingInput[],
  now: Date = new Date(),
): AgingReport {
  const buckets = {
    current: { count: 0, cents: 0 },
    d1_7: { count: 0, cents: 0 },
    d8_30: { count: 0, cents: 0 },
    d31_plus: { count: 0, cents: 0 },
  } satisfies AgingReport['buckets'];

  let totalCents = 0;
  let overdueCount = 0;
  let overdueCents = 0;

  for (const invoice of invoices) {
    const bucket = agingBucket(invoice, now);
    buckets[bucket].count += 1;
    buckets[bucket].cents += invoice.dueCents;
    totalCents += invoice.dueCents;

    if (bucket !== 'current') {
      overdueCount += 1;
      overdueCents += invoice.dueCents;
    }
  }

  return {
    buckets,
    totalCount: invoices.length,
    totalCents,
    overdueCount,
    overdueCents,
  };
}
