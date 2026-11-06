/**
 * Regras do painel: que datas cada período cobre, com o que ele se compara e
 * como os totais diários viram série de gráfico.
 *
 * Datas são strings `YYYY-MM-DD` do início ao fim. `Date` carrega fuso, e aqui
 * um dia é o dia do calendário do clube, não um instante.
 */

export const PERIOD_KEYS = ['month', 'last_month', '90d', '12m'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export type Granularity = 'day' | 'week' | 'month';

export type Period = {
  key: PeriodKey;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** Último dia desenhado: em "este mês", o eixo vai até o fim do mês. */
  axisTo: string;
  /** Último dia da linha de comparação, que pode passar de `prevTo`. */
  prevAxisTo: string;
  granularity: Granularity;
};

export type DayValue = { day: string; value: number };

export function isPeriodKey(value: string | undefined): value is PeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(value ?? '');
}

function toUtc(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDay(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

function firstOfMonth(day: string, monthOffset = 0): string {
  const date = toUtc(day);
  return toDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1)));
}

function lastOfMonth(day: string): string {
  return addDays(firstOfMonth(day, 1), -1);
}

/** O dia de hoje no fuso do clube. Às 22h em Nova York, em UTC já é amanhã. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function resolvePeriod(key: PeriodKey, today: string): Period {
  if (key === 'month') {
    const from = firstOfMonth(today);
    const prevFrom = firstOfMonth(today, -1);
    const prevAxisTo = addDays(from, -1);
    // Dia 10 contra dia 10. Comparar um mês pela metade com o anterior inteiro
    // mostraria queda todo começo de mês, sem nada ter caído.
    const elapsed = daysBetween(from, today);
    const sameDay = addDays(prevFrom, elapsed);
    const prevTo = sameDay > prevAxisTo ? prevAxisTo : sameDay;
    return {
      key,
      from,
      to: today,
      prevFrom,
      prevTo,
      axisTo: lastOfMonth(today),
      prevAxisTo,
      granularity: 'day',
    };
  }

  if (key === 'last_month') {
    const from = firstOfMonth(today, -1);
    const to = addDays(firstOfMonth(today), -1);
    const prevFrom = firstOfMonth(today, -2);
    const prevTo = addDays(from, -1);
    return { key, from, to, prevFrom, prevTo, axisTo: to, prevAxisTo: prevTo, granularity: 'day' };
  }

  const length = key === '90d' ? 90 : 365;
  const from = addDays(today, -(length - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(length - 1));
  return {
    key,
    from,
    to: today,
    prevFrom,
    prevTo,
    axisTo: today,
    prevAxisTo: prevTo,
    granularity: key === '90d' ? 'week' : 'month',
  };
}

/** `null` sem base de comparação: subir de zero não é "mais infinito por cento". */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** `null` quando não existe o todo: 0 de 0 não é 0%, é "ainda sem dados". */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function indexByDay(points: readonly DayValue[]): Map<string, number> {
  return new Map(points.map((p) => [p.day, p.value]));
}

export type ComparisonPoint = {
  day: string;
  prevDay: string | null;
  current: number | null;
  previous: number | null;
};

/**
 * Acumulado do período contra o anterior, dia a dia. A linha atual para em
 * `to`, sem riscar o futuro como se nada fosse entrar. A anterior segue até o
 * fim do período dela, que é o que mostra se o ritmo está à frente.
 */
export function cumulativeComparison(points: readonly DayValue[], period: Period): ComparisonPoint[] {
  const values = indexByDay(points);
  const length = daysBetween(period.from, period.axisTo) + 1;
  const prevLength = daysBetween(period.prevFrom, period.prevAxisTo) + 1;

  const result: ComparisonPoint[] = [];
  let current = 0;
  let previous = 0;

  for (let i = 0; i < Math.max(length, prevLength); i += 1) {
    const day = addDays(period.from, i);
    const prevDay = i < prevLength ? addDays(period.prevFrom, i) : null;
    const inCurrent = i < length && day <= period.to;

    if (inCurrent) current += values.get(day) ?? 0;
    if (prevDay) previous += values.get(prevDay) ?? 0;

    if (i < length) {
      result.push({
        day,
        prevDay,
        current: inCurrent ? current : null,
        previous: prevDay ? previous : null,
      });
    }
  }

  return result;
}

export type Bucket = { start: string; end: string; value: number };

/** Agrupa em dias, semanas ou meses, e dia sem movimento entra como zero. */
export function bucketize(
  points: readonly DayValue[],
  from: string,
  to: string,
  granularity: Granularity,
): Bucket[] {
  const values = indexByDay(points);
  const buckets: Bucket[] = [];
  let start = from;

  while (start <= to) {
    let end = start;
    if (granularity === 'week') end = addDays(start, 6);
    if (granularity === 'month') end = lastOfMonth(start);
    if (end > to) end = to;

    let value = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
      value += values.get(day) ?? 0;
    }

    buckets.push({ start, end, value });
    start = addDays(end, 1);
  }

  return buckets;
}

export type RankedItem = { key: string | null; value: number };

/**
 * Mantém os maiores e soma o resto numa linha só. A lista nunca cresce a ponto
 * de virar ruído, e o total continua fechando.
 */
export function foldRanked(items: readonly RankedItem[], max: number): {
  items: RankedItem[];
  otherValue: number;
} {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  return {
    items: sorted.slice(0, max),
    otherValue: sorted.slice(max).reduce((sum, item) => sum + item.value, 0),
  };
}

/**
 * Marcas redondas no eixo: 0, 2.500, 5.000, e não 0, 2.317, 4.634.
 *
 * `integer` é para contagem: não existe 0,25 treino, e arredondar a marca na
 * tela deixaria o eixo escrito 0, 0, 1, 1, 1.
 */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const step = integer ? Math.max(1, Math.ceil(nice)) : nice;
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) {
    ticks.push(Number(value.toFixed(6)));
    if (value >= max) break;
  }
  return ticks;
}

/**
 * Projeção linear do mês. Antes do dia 7 fica `null`: um pagamento grande no
 * dia 2 viraria uma previsão absurda que alguém levaria a sério.
 */
export function projectMonth(
  receivedCents: number,
  today: string,
  period: Period,
): number | null {
  if (period.key !== 'month') return null;
  const elapsed = daysBetween(period.from, today) + 1;
  if (elapsed < 7) return null;
  const total = daysBetween(period.from, period.axisTo) + 1;
  return Math.round((receivedCents / elapsed) * total);
}
