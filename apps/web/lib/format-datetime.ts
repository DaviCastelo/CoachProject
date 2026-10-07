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

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte para Date respeitando a diferença entre DATA e INSTANTE.
 *
 * `new Date('2026-10-15')` é interpretado como meia-noite **UTC** por
 * especificação. Formatado num fuso negativo (America/New_York, UTC-5, ou
 * America/Sao_Paulo, UTC-3) isso volta para as 21h do dia 14 e a tela mostra
 * o dia ERRADO.
 *
 * As colunas `date` do banco (`invoices.due_on`, `programs.starts_on`,
 * `athletes.date_of_birth`) não representam um instante no tempo: 15 de
 * outubro é 15 de outubro em qualquer fuso. Então são montadas como
 * meia-noite LOCAL, que é o que faz o dia sair inteiro na formatação.
 *
 * Já `timestamptz` (`sessions.starts_at`) é instante de verdade e continua
 * sendo convertido pelo caminho normal, para aparecer no horário do usuário.
 */
function toDate(value: string | Date): Date {
  if (typeof value !== 'string') return value;

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  return new Date(value);
}
