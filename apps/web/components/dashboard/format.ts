export type ValueKind = 'money' | 'count' | 'percent' | 'hours';

export type ValueFormat = { kind: ValueKind; locale: string; currency?: string };

/** Valor redondo sem `,00`: num painel, centavo zerado só ocupa espaço. */
export function formatValue(value: number, { kind, locale, currency = 'usd' }: ValueFormat): string {
  if (kind === 'money') {
    const whole = value % 100 === 0;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(value / 100);
  }
  if (kind === 'percent') {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: kind === 'hours' ? 1 : 0 }).format(value);
}

/** Eixo: 10 mil cabe, $10,000.00 em cada marca não. */
export function formatAxis(value: number, { kind, locale, currency = 'usd' }: ValueFormat): string {
  const amount = kind === 'money' ? value / 100 : value;
  return new Intl.NumberFormat(locale, {
    ...(kind === 'money' ? { style: 'currency', currency: currency.toUpperCase() } : {}),
    notation: amount >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(amount);
}
