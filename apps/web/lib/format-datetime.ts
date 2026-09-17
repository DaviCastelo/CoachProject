/** Formatters de data/hora no locale ativo (pt-BR, en, es). */

export function formatDateTime(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(toDate(value));
}

export function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(toDate(value));
}

export function formatDateShort(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(toDate(value));
}

export function formatDateRange(
  start: string | Date | null,
  end: string | Date | null,
  locale: string,
): string | null {
  if (!start) return null;
  const from = formatDateShort(start, locale);
  if (!end) return from;
  return `${from} – ${formatDateShort(end, locale)}`;
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}
