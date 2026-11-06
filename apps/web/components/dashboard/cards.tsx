'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Sparkline } from './charts';
import type { ValueFormat } from './format';
import { AnimatedNumber, Reveal } from './reveal';

const SURFACE = 'rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-sm';

export type TableView = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

/*
 * Todo gráfico tem a versão em tabela: é ela que torna os números acessíveis a
 * quem não enxerga a cor ou não consegue passar o mouse por cima.
 *
 * Sem `overflow-hidden` no card: ele cortaria a tooltip do gráfico.
 */
export function ChartCard({
  title,
  subtitle,
  table,
  empty,
  emptyText,
  children,
  className,
  index = 0,
}: Readonly<{
  title: string;
  subtitle?: string;
  table?: TableView;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}>) {
  const t = useTranslations('dashboard');
  const [showTable, setShowTable] = useState(false);

  return (
    <Reveal index={index} className={cn(SURFACE, 'flex min-w-0 flex-col p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {table && !empty ? (
          <button
            type="button"
            className="shrink-0 rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? t('viewChart') : t('viewTable')}
          </button>
        ) : null}
      </div>

      {empty ? (
        <p className="flex min-h-24 flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : showTable && table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {table.headers.map((header) => (
                  <th key={header} scope="col" className="pb-2 pr-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {table.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1.5 pr-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Reveal>
  );
}

export function Delta({
  percent,
  label,
  upIsGood = true,
  suffix = '%',
  fallback,
}: Readonly<{
  percent: number | null;
  label: string;
  upIsGood?: boolean;
  suffix?: string;
  /** O que dizer sem base de comparação. Sem isto, não mostra nada. */
  fallback?: string;
}>) {
  if (percent === null) {
    return fallback ? <span className="text-xs text-muted-foreground">{fallback}</span> : null;
  }

  const rounded = Math.round(percent);
  const Icon = rounded === 0 ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  const good = rounded === 0 ? null : rounded > 0 === upIsGood;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold',
          good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-danger',
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {Math.abs(rounded)}
        {suffix}
      </span>
      {label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  format,
  hint,
  delta,
  trend,
  href,
  tag,
  tone,
  index = 0,
}: Readonly<{
  label: string;
  value: number | null;
  format: ValueFormat;
  hint?: string;
  delta?: React.ReactNode;
  trend?: readonly number[];
  href?: string;
  /** Marca os números de agora, que não mudam com o período escolhido. */
  tag?: string;
  tone?: 'danger';
  index?: number;
}>) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {tag ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        ) : null}
      </div>
      <p className={cn('mt-1 text-2xl font-semibold leading-tight sm:text-3xl', tone === 'danger' && 'text-danger')}>
        {value === null ? '–' : <AnimatedNumber value={value} format={format} />}
      </p>
      {delta ? <div className="mt-1">{delta}</div> : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {trend ? (
        <div className="mt-2">
          <Sparkline values={trend} />
        </div>
      ) : null}
    </>
  );

  return (
    <Reveal index={index} className={cn(SURFACE, 'min-w-0 p-4')}>
      {href ? (
        <Link
          href={href}
          className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </Reveal>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: Readonly<{ title: string; subtitle?: string }>) {
  return (
    <div className="mb-3 mt-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function HeroCard({
  label,
  value,
  format,
  delta,
  children,
}: Readonly<{
  label: string;
  value: number;
  format: ValueFormat;
  delta: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <Reveal className={cn(SURFACE, 'viz-hero relative min-w-0 p-4 sm:p-6')}>
      <p className="text-eyebrow text-accent-700 dark:text-accent-500">{label}</p>
      <p className="mt-1 text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
        <AnimatedNumber value={value} format={format} />
      </p>
      <div className="mb-5 mt-2">{delta}</div>
      {children}
    </Reveal>
  );
}
