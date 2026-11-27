/**
 * Data `YYYY-MM-DD` quebrada em ano, mês e dia, e de volta.
 *
 * As partes são strings sem zero à esquerda ('2014', '2', '20') porque são os
 * valores das listas de `DateSelect`. Parte vazia é parte ainda não escolhida.
 */
export type DateParts = { year: string; month: string; day: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function splitIsoDate(value: string | null | undefined): DateParts {
  const match = ISO.exec((value ?? '').slice(0, 10));
  if (!match) return { year: '', month: '', day: '' };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

/** '' enquanto faltar alguma parte: data pela metade não é data. */
export function composeIsoDate({ year, month, day }: DateParts): string {
  if (!year || !month || !day) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Dias do mês. Sem mês, 31: ninguém fica impedido de escolher o dia primeiro.
 * Fevereiro sem ano conta 29, para não recusar quem nasceu em 29 de fevereiro
 * antes de dizer o ano.
 */
export function daysInMonth(year: string, month: string): number {
  if (!month) return 31;
  const m = Number(month);
  if (m === 2 && !year) return 29;
  const y = year ? Number(year) : 2000;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** `YYYY-MM-DDTHH:mm` (o formato de `datetime-local`) quebrado em data e hora. */
export function splitLocalDateTime(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

export function composeLocalDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : '';
}
