'use client';

import { useId, useState } from 'react';
import { niceTicks } from '@ca-tempo/domain';
import { cn } from '@/lib/utils';
import { formatAxis, formatValue, type ValueFormat } from './format';

/*
 * Gráficos em SVG e HTML, sem biblioteca. O painel é a primeira tela de quem
 * entra, e uma lib de gráficos somaria mais peso do que a página inteira.
 *
 * Coordenadas em porcentagem: o gráfico acompanha a largura do card sem medir
 * nada no navegador, então já sai certo do servidor e não pula ao carregar.
 *
 * As cores vêm de `--viz-*` no globals.css, validadas nos dois temas.
 */

function Tooltip({
  left,
  title,
  rows,
}: Readonly<{
  left: number;
  title: string;
  rows: readonly { key: string; label: string; value: string; muted?: boolean }[];
}>) {
  // Perto das bordas o balão ancora no lado de dentro para não ser cortado.
  const shift = left > 70 ? '-100%' : left < 30 ? '0%' : '-50%';

  return (
    <div
      className="pointer-events-none absolute top-0 z-20 min-w-32 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
      style={{ left: `${left}%`, transform: `translateX(${shift})` }}
      role="status"
    >
      <p className="mb-1 whitespace-nowrap text-xs text-muted-foreground">{title}</p>
      {rows.map((row) => (
        <p key={row.key} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="h-0.5 w-3 rounded-full"
            style={{ background: row.muted ? 'var(--viz-muted)' : 'var(--viz-1)' }}
          />
          <span className="text-sm font-semibold tabular-nums">{row.value}</span>
          <span className="text-xs text-muted-foreground">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

/** Foco único no gráfico, navegado por seta: 31 barras não são 31 paradas de Tab. */
function useActiveIndex(length: number) {
  const [active, setActive] = useState<number | null>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    setActive((current) => Math.min(length - 1, Math.max(0, (current ?? (step > 0 ? -1 : length)) + step)));
  }

  return { active, setActive, onKeyDown };
}

function YAxis({ ticks, format }: Readonly<{ ticks: number[]; format: ValueFormat }>) {
  const top = ticks[ticks.length - 1];

  return (
    <>
      {ticks.map((tick) => (
        <div
          key={tick}
          aria-hidden="true"
          className="absolute inset-x-0 h-px"
          style={{ bottom: `${(tick / top) * 100}%`, background: 'var(--viz-grid)' }}
        >
          <span className="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {formatAxis(tick, format)}
          </span>
        </div>
      ))}
    </>
  );
}

export type LinePoint = {
  tick: string;
  title: string;
  prevTitle: string | null;
  current: number | null;
  previous: number | null;
};

function linePath(values: readonly (number | null)[], top: number): string {
  const last = Math.max(values.length - 1, 1);
  return values
    .map((value, i) =>
      value === null ? null : `${(i / last) * 100} ${100 - (value / top) * 100}`,
    )
    .filter((point): point is string => point !== null)
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${point}`)
    .join(' ');
}

export function LineChart({
  points,
  format,
  currentLabel,
  previousLabel,
  ariaLabel,
}: Readonly<{
  points: readonly LinePoint[];
  format: ValueFormat;
  currentLabel: string;
  previousLabel: string;
  ariaLabel: string;
}>) {
  const gradient = useId();
  const { active, setActive, onKeyDown } = useActiveIndex(points.length);

  const peak = Math.max(1, ...points.flatMap((p) => [p.current ?? 0, p.previous ?? 0]));
  const ticks = niceTicks(peak, 4, format.kind === 'count');
  const top = ticks[ticks.length - 1];

  const last = Math.max(points.length - 1, 1);
  const currents = points.map((p) => p.current);
  const previous = points.map((p) => p.previous);
  const lastIndex = currents.reduce<number>((found, v, i) => (v === null ? found : i), 0);
  const currentPath = linePath(currents, top);
  const areaPath = `${currentPath} L${(lastIndex / last) * 100} 100 L0 100 Z`;
  const endValue = points[lastIndex]?.current ?? 0;

  const point = active === null ? null : points[active];
  const activeLeft = active === null ? 0 : (active / last) * 100;

  function pick(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    setActive(Math.min(last, Math.max(0, Math.round(fraction * last))));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: 'var(--viz-1)' }} />
          {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: 'var(--viz-muted)' }} />
          {previousLabel}
        </span>
      </div>

      <div className="relative ml-14 mr-2 h-56 pb-0">
        <YAxis ticks={ticks} format={format} />

        <div
          className="absolute inset-0 touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          <div className="viz-plot absolute inset-0">
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--viz-1)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--viz-1)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={linePath(previous, top)}
                fill="none"
                stroke="var(--viz-muted)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {currentPath ? <path d={areaPath} fill={`url(#${gradient})`} /> : null}
              <path
                d={currentPath}
                fill="none"
                stroke="var(--viz-1)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Fora do SVG porque ele estica: ali o ponto viraria uma elipse. */}
            <span
              aria-hidden="true"
              className="viz-pulse absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full"
              style={{
                left: `${(lastIndex / last) * 100}%`,
                bottom: `${(endValue / top) * 100}%`,
                background: 'var(--viz-1)',
                boxShadow: '0 0 0 2px var(--card)',
              }}
            />
          </div>

          {point ? (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-y-0 w-px"
                style={{ left: `${activeLeft}%`, background: 'var(--viz-muted)' }}
              />
              <Tooltip
                left={activeLeft}
                title={point.title}
                rows={[
                  ...(point.current === null
                    ? []
                    : [{ key: 'c', label: currentLabel, value: formatValue(point.current, format) }]),
                  ...(point.previous === null
                    ? []
                    : [
                        {
                          key: 'p',
                          label: point.prevTitle ?? previousLabel,
                          value: formatValue(point.previous, format),
                          muted: true,
                        },
                      ]),
                ]}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="ml-14 mr-2 mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{points[0]?.tick}</span>
        <span>{points[Math.floor(last / 2)]?.tick}</span>
        <span>{points[last]?.tick}</span>
      </div>
    </div>
  );
}

export type ColumnPoint = {
  tick: string;
  title: string;
  value: number;
  /** A coluna que importa. As outras ficam na cor de contexto. */
  emphasis?: boolean;
};

export function ColumnChart({
  points,
  format,
  seriesLabel,
  ariaLabel,
}: Readonly<{
  points: readonly ColumnPoint[];
  format: ValueFormat;
  seriesLabel: string;
  ariaLabel: string;
}>) {
  const { active, setActive, onKeyDown } = useActiveIndex(points.length);

  const ticks = niceTicks(Math.max(1, ...points.map((p) => p.value)), 4, format.kind === 'count');
  const top = ticks[ticks.length - 1];
  const everyNth = Math.ceil(points.length / 7);
  const anyEmphasis = points.some((p) => p.emphasis);
  const point = active === null ? null : points[active];

  return (
    <div>
      <div className="relative ml-14 mr-2 h-48">
        <YAxis ticks={ticks} format={format} />

        <div
          className="absolute inset-0 flex items-end gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          {points.map((p, i) => (
            <div
              key={`${p.title}-${i}`}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
            >
              <span
                className="viz-col block w-full max-w-6 rounded-t"
                style={
                  {
                    height: `${(p.value / top) * 100}%`,
                    minHeight: p.value > 0 ? 2 : 0,
                    background:
                      !anyEmphasis || p.emphasis || active === i ? 'var(--viz-1)' : 'var(--viz-soft)',
                    '--i': i,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>

        {point ? (
          <Tooltip
            left={(((active ?? 0) + 0.5) / points.length) * 100}
            title={point.title}
            rows={[{ key: 'v', label: seriesLabel, value: formatValue(point.value, format) }]}
          />
        ) : null}
      </div>

      <div className="ml-14 mr-2 mt-2 flex gap-[2px] text-[11px] tabular-nums text-muted-foreground">
        {points.map((p, i) => (
          <span key={`${p.title}-tick-${i}`} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % everyNth === 0 ? p.tick : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export type RankedRow = { key: string; label: string; value: number; note?: string };

export function RankedBars({
  rows,
  format,
}: Readonly<{ rows: readonly RankedRow[]; format: ValueFormat }>) {
  const top = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatValue(row.value, format)}
              {row.note ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{row.note}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--viz-track)' }}>
            <div
              className="viz-fill h-full rounded-full"
              style={
                {
                  width: `${(row.value / top) * 100}%`,
                  background: 'var(--viz-1)',
                  '--i': i,
                } as React.CSSProperties
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export type SegmentPart = { key: string; label: string; value: number; detail: string };

/** Um todo em partes ordenadas: a cor sobe na mesma escala do tempo em atraso. */
export function SegmentedBar({
  parts,
  ariaLabel,
}: Readonly<{ parts: readonly SegmentPart[]; ariaLabel: string }>) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <div>
      <div className="viz-plot flex h-7 gap-[2px]" role="img" aria-label={ariaLabel}>
        {parts.map((part, i) => {
          const share = total > 0 ? part.value / total : 0;
          if (share === 0) return null;
          return (
            <div
              key={part.key}
              title={`${part.label}: ${part.detail}`}
              className="flex min-w-0 items-center overflow-hidden rounded px-2 text-xs font-semibold"
              style={{
                flexGrow: part.value,
                flexBasis: 0,
                background: `var(--viz-ramp-${i + 1})`,
                color: `var(--viz-on-ramp-${i + 1})`,
              }}
            >
              {share >= 0.14 ? `${Math.round(share * 100)}%` : null}
            </div>
          );
        })}
      </div>

      <ul className="mt-3 space-y-1.5">
        {parts.map((part, i) => (
          <li key={part.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: `var(--viz-ramp-${i + 1})` }}
              />
              <span className="truncate">{part.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{part.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Meter({
  value,
  max,
  label,
  detail,
  severity = false,
  index = 0,
}: Readonly<{
  value: number;
  max: number;
  label?: string;
  detail?: string;
  /** Lotação: quanto mais cheio, mais a cor avisa. */
  severity?: boolean;
  index?: number;
}>) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  const fill =
    severity && share >= 1
      ? 'var(--color-danger)'
      : severity && share >= 0.85
        ? 'var(--color-warning)'
        : 'var(--viz-1)';

  return (
    <div>
      {label || detail ? (
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">{label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{detail}</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--viz-track)' }}>
        <div
          className="viz-fill h-full rounded-full"
          style={{ width: `${share * 100}%`, background: fill, '--i': index } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

export function Sparkline({ values }: Readonly<{ values: readonly number[] }>) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const top = Math.max(1, ...values);

  return (
    <svg
      className="viz-plot h-8 w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={linePath(values, top)}
        fill="none"
        stroke="var(--viz-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type HeatCell = { day: string; title: string; value: number } | null;

function heatLevel(value: number, top: number): number {
  if (value === 0) return 0;
  return Math.max(1, Math.ceil((value / top) * 4));
}

/** Uma coluna por semana, de segunda a domingo. */
export function ActivityHeatmap({
  weeks,
  weekdayLabels,
  lessLabel,
  moreLabel,
  ariaLabel,
}: Readonly<{
  weeks: readonly (readonly HeatCell[])[];
  weekdayLabels: readonly string[];
  lessLabel: string;
  moreLabel: string;
  ariaLabel: string;
}>) {
  const top = Math.max(1, ...weeks.flat().map((cell) => cell?.value ?? 0));
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex gap-1">
        <div className="mr-1 grid grid-rows-7 gap-1 text-[10px] leading-none text-muted-foreground">
          {weekdayLabels.map((label, i) => (
            <span key={i} className="flex items-center">
              {i % 2 === 0 ? label : ''}
            </span>
          ))}
        </div>

        {weeks.map((week, w) => (
          <div key={w} className="grid min-w-0 flex-1 grid-rows-7 gap-1">
            {week.map((cell, d) => (
              <span
                key={d}
                title={cell?.title}
                onPointerEnter={() => setHover(cell?.title ?? null)}
                onPointerLeave={() => setHover(null)}
                className="viz-cell block aspect-square rounded-[3px]"
                style={
                  {
                    background: cell
                      ? cell.value === 0
                        ? 'var(--viz-track)'
                        : `var(--viz-ramp-${heatLevel(cell.value, top)})`
                      : 'transparent',
                    '--i': w * 7 + d,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="min-h-4 truncate">{hover}</span>
        <span className="flex shrink-0 items-center gap-1">
          {lessLabel}
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={cn('h-2.5 w-2.5 rounded-sm')}
              style={{ background: level === 0 ? 'var(--viz-track)' : `var(--viz-ramp-${level})` }}
            />
          ))}
          {moreLabel}
        </span>
      </div>
    </div>
  );
}
