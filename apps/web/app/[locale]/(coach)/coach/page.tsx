import { getLocale, getTranslations } from 'next-intl/server';
import {
  AlertTriangle,
  Banknote,
  Cake,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  HardDrive,
  Mail,
  Timer,
  UserPlus,
} from 'lucide-react';
import {
  addDays,
  athleteAgeGroup,
  bucketize,
  cumulativeComparison,
  foldRanked,
  formatBytes,
  isPeriodKey,
  percentChange,
  PERIOD_KEYS,
  projectMonth,
  ratio,
  summarizeAging,
  daysOverdue,
  type Bucket,
  type Granularity,
  type PeriodKey,
} from '@ca-tempo/domain';
import { Link } from '@/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { formatDateTime } from '@/lib/format-datetime';
import { loadDashboard, type DashboardData, type FinanceData, type OperationsData } from '@/lib/dashboard/load';
import { cn } from '@/lib/utils';
import {
  ActivityHeatmap,
  ColumnChart,
  LineChart,
  Meter,
  RankedBars,
  SegmentedBar,
  type ColumnPoint,
  type HeatCell,
} from '@/components/dashboard/charts';
import { ChartCard, Delta, HeroCard, SectionTitle, StatTile } from '@/components/dashboard/cards';
import { formatValue, type ValueFormat } from '@/components/dashboard/format';
import { Reveal } from '@/components/dashboard/reveal';
import { listSessions, type SessionListItem } from './schedule/actions';

/**
 * Painel principal.
 *
 * Abre com o que precisa de ação, depois responde as perguntas do dono na ordem
 * em que ele faz: quanto entrou, quanto falta, o clube está crescendo, a galera
 * está vindo treinar, e o que vem pela frente.
 *
 * Dinheiro só aparece para owner e admin. O coach vê a operação.
 */

export const dynamic = 'force-dynamic';

type PageProps = { searchParams: Promise<{ period?: string }> };
type T = Awaited<ReturnType<typeof getTranslations<'dashboard'>>>;

const SURFACE = 'rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-sm';

function utcDate(day: string): Date {
  return new Date(`${day.slice(0, 10)}T00:00:00Z`);
}

function dayLabel(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utcDate(day));
}

function bucketPoints(
  buckets: readonly Bucket[],
  granularity: Granularity,
  locale: string,
): ColumnPoint[] {
  return buckets.map((bucket, i) => {
    const short = dayLabel(bucket.start, locale, { month: 'short', day: 'numeric' });
    const month = dayLabel(bucket.start, locale, { month: 'short' });

    return {
      value: bucket.value,
      emphasis: i === buckets.length - 1,
      tick:
        granularity === 'day'
          ? dayLabel(bucket.start, locale, { day: 'numeric' })
          : granularity === 'week'
            ? short
            : month,
      title:
        granularity === 'day'
          ? short
          : granularity === 'week'
            ? `${short} – ${dayLabel(bucket.end, locale, { month: 'short', day: 'numeric' })}`
            : dayLabel(bucket.start, locale, { month: 'long', year: 'numeric' }),
    };
  });
}

function timeAgo(iso: string, locale: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return format.format(Math.round(seconds / 3600), 'hour');
  if (abs < 2_592_000) return format.format(Math.round(seconds / 86_400), 'day');
  return format.format(Math.round(seconds / 2_592_000), 'month');
}

export default async function CoachDashboardPage({ searchParams }: PageProps) {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('dashboard');
  const locale = await getLocale();
  const { period: requested } = await searchParams;

  const periodKey: PeriodKey = isPeriodKey(requested) ? requested : 'month';
  const canSeeMoney = ctx.role === 'owner' || ctx.role === 'admin';

  const [data, sessions] = await Promise.all([
    loadDashboard(ctx.orgId, periodKey, canSeeMoney),
    listSessions(),
  ]);

  const { finance, operations, period, currency } = data;
  const money: ValueFormat = { kind: 'money', locale, currency };
  const count: ValueFormat = { kind: 'count', locale };

  const now = Date.now();
  const upcoming = sessions
    .filter((s) => new Date(s.endsAt).getTime() >= now && s.status !== 'canceled')
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-10">
      {/* A entrada esconde os cards até o JS marcar; sem JS, ficam visíveis. */}
      <noscript>
        <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
      </noscript>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow text-accent-700 dark:text-accent-500">{ctx.orgName}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {dayLabel(data.today, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </header>

      <Attention data={data} canSeeMoney={canSeeMoney} t={t} locale={locale} />

      <nav
        aria-label={t('periodLabel')}
        className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 sm:w-fit"
      >
        {PERIOD_KEYS.map((key) => (
          <Link
            key={key}
            href={{ pathname: '/coach', query: key === 'month' ? {} : { period: key } }}
            scroll={false}
            aria-current={key === periodKey ? 'page' : undefined}
            className={cn(
              'flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm transition-colors sm:flex-none',
              key === periodKey
                ? 'bg-accent-500 font-medium text-ink-950'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(`period_${key}`)}
          </Link>
        ))}
      </nav>

      {finance ? (
        <MoneySection
          data={data}
          finance={finance}
          operations={operations}
          money={money}
          t={t}
          locale={locale}
        />
      ) : null}

      <GrowthSection data={data} count={count} t={t} locale={locale} />
      <TrainingSection data={data} upcoming={upcoming} count={count} t={t} locale={locale} />
      <ClubSection data={data} count={count} t={t} locale={locale} />
      <ActivitySection data={data} money={money} t={t} locale={locale} />

      <p className="text-xs text-muted-foreground">
        {t('footnote', { period: t(`period_${period.key}`) })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atenção
// ---------------------------------------------------------------------------

function Attention({
  data,
  canSeeMoney,
  t,
  locale,
}: Readonly<{ data: DashboardData; canSeeMoney: boolean; t: T; locale: string }>) {
  const { finance, operations, library } = data;
  const aging = finance ? agingOf(finance) : null;
  const libraryShare = library ? (ratio(library.used_bytes, library.quota_bytes) ?? 0) : 0;

  const items = [
    {
      key: 'paidForms',
      count: finance?.paid_forms_closed ?? 0,
      href: '/coach/forms',
      icon: AlertTriangle,
      critical: true,
      text: (n: number) => t('attention_paidForms', { count: n }),
    },
    {
      key: 'overdue',
      count: aging?.overdueCount ?? 0,
      href: '/coach/payments',
      icon: Banknote,
      critical: true,
      text: (n: number) =>
        t('attention_overdue', {
          count: n,
          amount: formatValue(aging?.overdueCents ?? 0, { kind: 'money', locale, currency: data.currency }),
        }),
    },
    {
      key: 'registrations',
      count: operations.pending_registrations,
      href: '/coach/submissions',
      icon: ClipboardList,
      critical: false,
      text: (n: number) =>
        t(canSeeMoney ? 'attention_registrations' : 'attention_registrationsView', { count: n }),
    },
    {
      key: 'uninvoiced',
      count: finance?.uninvoiced_count ?? 0,
      href: '/coach/payments',
      icon: Banknote,
      critical: false,
      text: (n: number) => t('attention_uninvoiced', { count: n }),
    },
    {
      key: 'holds',
      count: finance?.expiring_holds ?? 0,
      href: '/coach/payments',
      icon: Timer,
      critical: false,
      text: (n: number) => t('attention_holds', { count: n }),
    },
    {
      key: 'emails',
      count: finance?.failed_emails ?? 0,
      href: '/coach/payments',
      icon: Mail,
      critical: false,
      text: (n: number) => t('attention_emails', { count: n }),
    },
    {
      key: 'library',
      count: libraryShare >= 0.8 ? Math.round(libraryShare * 100) : 0,
      href: '/coach/library',
      icon: HardDrive,
      critical: false,
      text: (n: number) => t('attention_library', { percent: n }),
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <Reveal className={cn(SURFACE, 'flex items-center gap-3 p-4')}>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-sm">{t('allClear')}</p>
      </Reveal>
    );
  }

  return (
    <section aria-label={t('attentionTitle')}>
      <h2 className="text-eyebrow mb-2 text-muted-foreground">{t('attentionTitle')}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Reveal index={i}>
                <Link
                  href={item.href}
                  className={cn(
                    SURFACE,
                    'group flex min-h-14 items-center gap-3 p-3 transition-colors hover:bg-muted/50',
                    item.critical && 'border-danger/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                      item.critical ? 'bg-danger/10 text-danger' : 'bg-accent-500/10 text-accent-700 dark:text-accent-500',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{item.text(item.count)}</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function agingOf(finance: FinanceData) {
  // O que está compensando já foi pago: cobrar a família de novo seria erro.
  const open = finance.open_invoices
    .map((i) => ({ ...i, dueCents: i.balance_cents - i.pending_cents }))
    .filter((i) => i.dueCents > 0);

  return summarizeAging(open.map((i) => ({ dueOn: i.due_on, createdAt: i.created_at, dueCents: i.dueCents })));
}

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

function MoneySection({
  data,
  finance,
  operations,
  money,
  t,
  locale,
}: Readonly<{
  data: DashboardData;
  finance: FinanceData;
  operations: OperationsData;
  money: ValueFormat;
  t: T;
  locale: string;
}>) {
  const { period, today } = data;
  const percent: ValueFormat = { kind: 'percent', locale };
  const compare = t(`compare_${period.key}`);
  const compareShort = t(`compareShort_${period.key}`);

  // Em 12 meses, os dois períodos têm o mesmo dia e mês: só o ano os separa.
  const dateStyle: Intl.DateTimeFormatOptions =
    period.key === '12m'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric' };

  const series = cumulativeComparison(finance.daily, period);
  const aging = agingOf(finance);
  const clearing = finance.open_invoices.reduce((sum, i) => sum + i.pending_cents, 0);
  const projection = projectMonth(finance.received_cents, today, period);
  const collection = ratio(finance.collected_of_invoiced_cents, finance.invoiced_cents);
  const ticket = finance.payment_count > 0 ? finance.received_cents / finance.payment_count : null;
  const prevTicket =
    finance.prev_payment_count > 0 ? finance.prev_received_cents / finance.prev_payment_count : 0;
  const perAthlete =
    operations.active_athletes > 0 ? finance.received_cents / operations.active_athletes : null;

  const methods = foldRanked(finance.by_method, 6);
  const programs = foldRanked(finance.by_program, 5);
  const noProgram = t('noProgram');
  const programRows = [
    ...programs.items.map((p) => ({ key: p.key ?? 'none', label: p.key ?? noProgram, value: p.value })),
    ...(programs.otherValue > 0
      ? [{ key: 'other', label: t('other'), value: programs.otherValue }]
      : []),
  ];
  const methodRows = [
    ...methods.items.map((m) => ({ key: m.key ?? 'other', label: t(`method_${m.key ?? 'other'}` as 'method_other'), value: m.value })),
    ...(methods.otherValue > 0 ? [{ key: 'folded', label: t('other'), value: methods.otherValue }] : []),
  ];

  const monthly: ColumnPoint[] = finance.monthly.map((m, i) => ({
    value: m.value,
    emphasis: i === finance.monthly.length - 1,
    tick: dayLabel(`${m.month}-01`, locale, { month: 'short' }),
    title: dayLabel(`${m.month}-01`, locale, { month: 'long', year: 'numeric' }),
  }));

  const agingParts = (['current', 'd1_7', 'd8_30', 'd31_plus'] as const).map((bucket) => ({
    key: bucket,
    label: t(`aging_${bucket}`),
    value: aging.buckets[bucket].cents,
    detail: `${formatValue(aging.buckets[bucket].cents, money)} · ${t('invoices', { count: aging.buckets[bucket].count })}`,
  }));

  const debtors = finance.open_invoices
    .map((i) => ({
      ...i,
      dueCents: i.balance_cents - i.pending_cents,
      days: daysOverdue({ dueOn: i.due_on, createdAt: i.created_at }),
    }))
    .filter((i) => i.dueCents > 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, 6);

  const received = (key: string) =>
    formatValue(key === 'current' ? finance.received_cents : finance.prev_received_cents, money);

  return (
    <section aria-label={t('moneyTitle')} className="space-y-3">
      <SectionTitle title={t('moneyTitle')} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <HeroCard
            label={t('heroLabel', { period: t(`period_${period.key}`) })}
            value={finance.received_cents}
            format={money}
            delta={
              <Delta
                percent={percentChange(finance.received_cents, finance.prev_received_cents)}
                label={`${compare} (${received('previous')})`}
                fallback={t('noComparison')}
              />
            }
          >
            <LineChart
              ariaLabel={t('paceAria', { current: received('current'), previous: received('previous') })}
              format={money}
              currentLabel={t('paceCurrent')}
              previousLabel={t('pacePrevious')}
              points={series.map((point) => ({
                tick: dayLabel(point.day, locale, { month: 'short', day: 'numeric' }),
                title: dayLabel(point.day, locale, dateStyle),
                prevTitle: point.prevDay ? dayLabel(point.prevDay, locale, dateStyle) : null,
                current: point.current,
                previous: point.previous,
              }))}
            />
          </HeroCard>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-1">
          <StatTile
            index={1}
            label={t('outstanding')}
            value={aging.totalCents}
            format={money}
            hint={t('invoices', { count: aging.totalCount })}
            tag={t('now')}
            href="/coach/payments"
          />
          <StatTile
            index={2}
            label={t('overdue')}
            value={aging.overdueCents}
            format={money}
            hint={t('invoices', { count: aging.overdueCount })}
            tag={t('now')}
            tone={aging.overdueCents > 0 ? 'danger' : undefined}
            href="/coach/payments"
          />
          <StatTile
            index={3}
            label={t('clearing')}
            value={clearing}
            format={money}
            hint={t('clearingHint')}
            tag={t('now')}
          />
          {projection !== null ? (
            <StatTile
              index={4}
              label={t('projection')}
              value={projection}
              format={money}
              hint={t('projectionHint')}
            />
          ) : (
            <StatTile
              index={4}
              label={t('payments')}
              value={finance.payment_count}
              format={{ kind: 'count', locale }}
              delta={<Delta percent={percentChange(finance.payment_count, finance.prev_payment_count)} label={compareShort} />}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          index={0}
          label={t('invoiced')}
          value={finance.invoiced_cents}
          format={money}
          delta={<Delta percent={percentChange(finance.invoiced_cents, finance.prev_invoiced_cents)} label={compareShort} />}
        />
        <StatTile
          index={1}
          label={t('collection')}
          value={collection}
          format={percent}
          hint={t('collectionHint')}
        />
        <StatTile
          index={2}
          label={t('ticket')}
          value={ticket === null ? null : Math.round(ticket)}
          format={money}
          delta={
            ticket === null ? undefined : (
              <Delta percent={percentChange(ticket, prevTicket)} label={compareShort} />
            )
          }
        />
        <StatTile
          index={3}
          label={t('perAthlete')}
          value={perAthlete === null ? null : Math.round(perAthlete)}
          format={money}
          hint={t('perAthleteHint')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title={t('monthlyTitle')}
          subtitle={t('monthlySubtitle')}
          empty={monthly.every((m) => m.value === 0)}
          emptyText={t('emptyMoney')}
          table={{
            headers: [t('colMonth'), t('colReceived')],
            rows: monthly.map((m) => [m.title, formatValue(m.value, money)]),
          }}
        >
          <ColumnChart
            points={monthly}
            format={money}
            seriesLabel={t('colReceived')}
            ariaLabel={t('monthlyTitle')}
          />
        </ChartCard>

        <ChartCard
          index={1}
          title={t('agingTitle')}
          subtitle={t('agingSubtitle')}
          empty={aging.totalCents === 0}
          emptyText={t('emptyAging')}
        >
          <SegmentedBar parts={agingParts} ariaLabel={t('agingTitle')} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title={t('methodTitle')}
          subtitle={t(`period_${period.key}`)}
          empty={methodRows.length === 0}
          emptyText={t('emptyMoney')}
        >
          <RankedBars rows={methodRows} format={money} />
        </ChartCard>

        <ChartCard
          index={1}
          title={t('programTitle')}
          subtitle={t(`period_${period.key}`)}
          empty={programRows.length === 0}
          emptyText={t('emptyMoney')}
        >
          <RankedBars rows={programRows} format={money} />
        </ChartCard>

        <ChartCard
          index={2}
          title={t('debtorsTitle')}
          subtitle={t('debtorsSubtitle')}
          empty={debtors.length === 0}
          emptyText={t('emptyAging')}
        >
          <ul className="divide-y divide-border">
            {debtors.map((debtor) => (
              <li key={debtor.id} className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0">
                <span className="min-w-0">
                  <span className="block truncate">{debtor.athlete || debtor.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {debtor.days > 0 ? t('daysLate', { count: debtor.days }) : t('notDue')}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatValue(debtor.dueCents, money)}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {finance.discount_cents + finance.refunded_cents + finance.fee_cents > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label={t('discounts')} value={finance.discount_cents} format={money} />
          <StatTile index={1} label={t('refunds')} value={finance.refunded_cents} format={money} />
          <StatTile index={2} label={t('fees')} value={finance.fee_cents} format={money} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Crescimento
// ---------------------------------------------------------------------------

function GrowthSection({
  data,
  count,
  t,
  locale,
}: Readonly<{ data: DashboardData; count: ValueFormat; t: T; locale: string }>) {
  const { operations: o, period } = data;
  const compare = t(`compareShort_${period.key}`);

  const buckets = bucketize(o.registrations_daily, period.from, period.to, period.granularity);
  const points = bucketPoints(buckets, period.granularity, locale);

  const funnel = [
    { key: 'received', label: t('funnel_received'), value: o.funnel.received },
    { key: 'approved', label: t('funnel_approved'), value: o.funnel.approved },
    { key: 'invoiced', label: t('funnel_invoiced'), value: o.funnel.invoiced },
    { key: 'paid', label: t('funnel_paid'), value: o.funnel.paid },
  ].map((step) => {
    const share = ratio(step.value, o.funnel.received);
    return { ...step, note: share === null ? undefined : formatValue(share, { kind: 'percent', locale }) };
  });

  const programs = foldRanked(o.by_program, 5);
  const programRows = [
    ...programs.items.map((p) => ({
      key: p.key ?? 'none',
      label: p.key ?? t('noProgram'),
      value: p.value,
    })),
    ...(programs.otherValue > 0 ? [{ key: 'other', label: t('other'), value: programs.otherValue }] : []),
  ];

  return (
    <section aria-label={t('growthTitle')} className="space-y-3">
      <SectionTitle title={t('growthTitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('newRegistrations')}
          value={o.registrations}
          format={count}
          delta={<Delta percent={percentChange(o.registrations, o.prev_registrations)} label={compare} />}
          href="/coach/submissions"
        />
        <StatTile
          index={1}
          label={t('activeAthletes')}
          value={o.active_athletes}
          format={count}
          hint={t('families', { count: o.families })}
          tag={t('now')}
        />
        <StatTile
          index={2}
          label={t('newAthletes')}
          value={o.new_athletes}
          format={count}
          delta={<Delta percent={percentChange(o.new_athletes, o.prev_new_athletes)} label={compare} />}
        />
        <StatTile
          index={3}
          label={t('waitlist')}
          value={o.waitlisted}
          format={count}
          hint={t('waitlistHint')}
          tag={t('now')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-1"
          title={t('registrationsChart')}
          subtitle={t(`period_${period.key}`)}
          empty={o.registrations === 0}
          emptyText={t('emptyRegistrations')}
          table={{
            headers: [t('colPeriod'), t('colRegistrations')],
            rows: points.map((p) => [p.title, formatValue(p.value, count)]),
          }}
        >
          <ColumnChart
            points={points}
            format={count}
            seriesLabel={t('colRegistrations')}
            ariaLabel={t('registrationsChart')}
          />
        </ChartCard>

        <ChartCard
          index={1}
          title={t('funnelTitle')}
          subtitle={t('funnelSubtitle')}
          empty={o.funnel.received === 0}
          emptyText={t('emptyRegistrations')}
        >
          <RankedBars rows={funnel} format={count} />
        </ChartCard>

        <ChartCard
          index={2}
          title={t('registrationsByProgram')}
          subtitle={t(`period_${period.key}`)}
          empty={programRows.length === 0}
          emptyText={t('emptyRegistrations')}
        >
          <RankedBars rows={programRows} format={count} />
        </ChartCard>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Treinos
// ---------------------------------------------------------------------------

function TrainingSection({
  data,
  upcoming,
  count,
  t,
  locale,
}: Readonly<{
  data: DashboardData;
  upcoming: SessionListItem[];
  count: ValueFormat;
  t: T;
  locale: string;
}>) {
  const { operations: o, period, today } = data;
  const percent: ValueFormat = { kind: 'percent', locale };
  const hours: ValueFormat = { kind: 'hours', locale };
  const compare = t(`compareShort_${period.key}`);

  const rate = ratio(o.attended, o.attended + o.missed);
  const prevRate = ratio(o.prev_attended, o.prev_attended + o.prev_missed);
  const rsvp = ratio(o.rsvp_answered, o.rsvp_total);

  const attendance = bucketPoints(
    bucketize(o.attendance_daily, period.from, period.to, period.granularity),
    period.granularity,
    locale,
  );

  // 2024-01-01 foi uma segunda: base fixa só para pegar o nome do dia.
  const weekdayName = (dow: number, style: 'short' | 'narrow' | 'long') =>
    dayLabel(addDays('2024-01-01', dow - 1), locale, { weekday: style });

  const weekdays: ColumnPoint[] = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
    tick: weekdayName(dow, 'short'),
    title: weekdayName(dow, 'long'),
    value: o.weekdays.find((w) => w.dow === dow)?.value ?? 0,
  }));

  const activityByDay = new Map(o.activity.map((a) => [a.day, a.value]));
  const firstDay = addDays(today, -83);
  const weekday = (utcDate(firstDay).getUTCDay() + 6) % 7;
  const gridStart = addDays(firstDay, -weekday);
  const weeks: HeatCell[][] = [];
  for (let day = gridStart; day <= today; day = addDays(day, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const cellDay = addDays(day, i);
        if (cellDay < firstDay || cellDay > today) return null;
        const value = activityByDay.get(cellDay) ?? 0;
        return {
          day: cellDay,
          value,
          title: `${dayLabel(cellDay, locale, { month: 'short', day: 'numeric' })}: ${t('sessionsCount', { count: value })}`,
        };
      }),
    );
  }

  return (
    <section aria-label={t('trainingTitle')} className="space-y-3">
      <SectionTitle title={t('trainingTitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('sessionsHeld')}
          value={o.sessions_held}
          format={count}
          delta={<Delta percent={percentChange(o.sessions_held, o.prev_sessions_held)} label={compare} />}
        />
        <StatTile
          index={1}
          label={t('hoursTrained')}
          value={o.minutes_trained / 60}
          format={hours}
          hint={t('canceledSessions', { count: o.sessions_canceled })}
        />
        <StatTile
          index={2}
          label={t('attendanceRate')}
          value={rate}
          format={percent}
          hint={
            rate === null
              ? t('attendanceHint')
              : prevRate === null
                ? t('attendanceCount', { attended: o.attended, total: o.attended + o.missed })
                : undefined
          }
          delta={
            rate !== null && prevRate !== null ? (
              <Delta percent={(rate - prevRate) * 100} suffix={` ${t('points')}`} label={compare} />
            ) : undefined
          }
        />
        <StatTile
          index={3}
          label={t('rsvpRate')}
          value={rsvp}
          format={percent}
          hint={t('rsvpHint')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title={t('attendanceChart')}
          subtitle={t(`period_${period.key}`)}
          empty={o.attended === 0}
          emptyText={t('emptyAttendance')}
          table={{
            headers: [t('colPeriod'), t('colAttendance')],
            rows: attendance.map((p) => [p.title, formatValue(p.value, count)]),
          }}
        >
          <ColumnChart
            points={attendance}
            format={count}
            seriesLabel={t('colAttendance')}
            ariaLabel={t('attendanceChart')}
          />
        </ChartCard>

        <ChartCard
          index={1}
          title={t('weekdayChart')}
          subtitle={t(`period_${period.key}`)}
          empty={o.sessions_held === 0}
          emptyText={t('emptySessions')}
          table={{
            headers: [t('colWeekday'), t('colSessions')],
            rows: weekdays.map((p) => [p.title, formatValue(p.value, count)]),
          }}
        >
          <ColumnChart
            points={weekdays}
            format={count}
            seriesLabel={t('colSessions')}
            ariaLabel={t('weekdayChart')}
          />
        </ChartCard>

        <ChartCard
          index={2}
          title={t('activityTitle')}
          subtitle={t('activitySubtitle')}
          empty={o.activity.length === 0}
          emptyText={t('emptySessions')}
          table={{
            headers: [t('colDay'), t('colSessions')],
            rows: o.activity.map((a) => [
              dayLabel(a.day, locale, { month: 'short', day: 'numeric' }),
              formatValue(a.value, count),
            ]),
          }}
        >
          <ActivityHeatmap
            weeks={weeks}
            weekdayLabels={[1, 2, 3, 4, 5, 6, 7].map((dow) => weekdayName(dow, 'narrow'))}
            lessLabel={t('less')}
            moreLabel={t('more')}
            ariaLabel={t('activityTitle')}
          />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title={t('upcomingTitle')}
          empty={upcoming.length === 0}
          emptyText={t('emptyUpcoming')}
        >
          <ul className="space-y-3">
            {upcoming.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/coach/schedule/${session.id}`}
                  className="block rounded hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(session.startsAt, locale)}
                    {session.groupNames.length > 0 ? ` · ${session.groupNames.join(', ')}` : ''}
                  </p>
                  <p className="mt-1 flex gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('going', { count: session.going })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('noReply', { count: session.noReply })}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          index={1}
          title={t('missingTitle')}
          subtitle={t('missingSubtitle')}
          empty={o.missing_athletes.length === 0}
          emptyText={t('emptyMissing')}
        >
          <ul className="divide-y divide-border">
            {o.missing_athletes.map((athlete) => (
              <li key={athlete.id} className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0">
                <span className="min-w-0 truncate">{athlete.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t('daysAway', { count: athlete.days })}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          index={2}
          title={t('birthdaysTitle')}
          subtitle={t('birthdaysSubtitle')}
          empty={o.birthdays.length === 0}
          emptyText={t('emptyBirthdays')}
        >
          <ul className="divide-y divide-border">
            {o.birthdays.map((birthday) => (
              <li key={birthday.id} className="flex items-center gap-2 py-2 text-sm first:pt-0">
                <Cake className="h-4 w-4 shrink-0 text-accent-700 dark:text-accent-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{birthday.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {birthday.date === today
                    ? t('today')
                    : dayLabel(birthday.date, locale, { month: 'short', day: 'numeric' })}
                  {' · '}
                  {t('turning', { age: birthday.age })}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Clube
// ---------------------------------------------------------------------------

function ClubSection({
  data,
  count,
  t,
  locale,
}: Readonly<{ data: DashboardData; count: ValueFormat; t: T; locale: string }>) {
  const { operations: o, library, today } = data;

  const ageGroups = new Map<string, number>();
  for (const { year, value } of o.birth_years) {
    const group = athleteAgeGroup(new Date(year, 6, 1), utcDate(today));
    ageGroups.set(group, (ageGroups.get(group) ?? 0) + value);
  }
  const ages: ColumnPoint[] = [...ageGroups.entries()]
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([group, value]) => ({ tick: group, title: group, value }));

  return (
    <section aria-label={t('clubTitle')} className="space-y-3">
      <SectionTitle title={t('clubTitle')} subtitle={t('clubSubtitle')} />

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title={t('groupsTitle')}
          subtitle={t('groupsSubtitle')}
          empty={o.groups.length === 0}
          emptyText={t('emptyGroups')}
        >
          <ul className="space-y-3">
            {o.groups.map((group, i) => (
              <li key={group.id}>
                <Meter
                  index={i}
                  severity
                  value={group.members}
                  max={group.capacity}
                  label={group.name}
                  detail={`${group.members}/${group.capacity}${group.waitlist > 0 ? ` · ${t('waitingShort', { count: group.waitlist })}` : ''}`}
                />
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          index={1}
          title={t('programsTitle')}
          subtitle={t('programsSubtitle')}
          empty={o.programs.length === 0}
          emptyText={t('emptyPrograms')}
        >
          <ul className="space-y-3">
            {o.programs.map((program, i) => (
              <li key={program.id}>
                <Meter
                  index={i}
                  severity
                  value={program.taken}
                  max={program.capacity}
                  label={program.name}
                  detail={`${program.taken}/${program.capacity}`}
                />
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          index={2}
          title={t('ageTitle')}
          subtitle={t('ageSubtitle')}
          empty={ages.length === 0}
          emptyText={t('emptyAthletes')}
          table={{
            headers: [t('colAgeGroup'), t('colAthletes')],
            rows: ages.map((a) => [a.title, formatValue(a.value, count)]),
          }}
        >
          <ColumnChart
            points={ages}
            format={count}
            seriesLabel={t('colAthletes')}
            ariaLabel={t('ageTitle')}
          />
        </ChartCard>
      </div>

      {library && library.quota_bytes > 0 ? (
        <Reveal className={cn(SURFACE, 'p-4')}>
          <Link href="/coach/library" className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
            <Meter
              severity
              value={library.used_bytes}
              max={library.quota_bytes}
              label={t('libraryTitle')}
              detail={`${formatBytes(library.used_bytes, locale)} / ${formatBytes(library.quota_bytes, locale)}`}
            />
          </Link>
        </Reveal>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Atividade recente
// ---------------------------------------------------------------------------

function ActivitySection({
  data,
  money,
  t,
  locale,
}: Readonly<{ data: DashboardData; money: ValueFormat; t: T; locale: string }>) {
  const { finance, operations } = data;

  const feed = [
    ...(finance?.recent_payments ?? []).map((payment) => ({
      id: `p-${payment.id}`,
      at: payment.paid_at,
      icon: Banknote,
      text: t('feedPayment', {
        amount: formatValue(payment.cents, money),
        athlete: payment.athlete,
        method: t(`method_${payment.method}` as 'method_other'),
      }),
    })),
    ...operations.recent_registrations.map((registration) => ({
      id: `r-${registration.id}`,
      at: registration.created_at,
      icon: UserPlus,
      text: t('feedRegistration', {
        athlete: registration.athlete,
        program: registration.program ?? t('noProgram'),
      }),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return (
    <section aria-label={t('feedTitle')}>
      <ChartCard title={t('feedTitle')} empty={feed.length === 0} emptyText={t('emptyFeed')}>
        <ul className="divide-y divide-border">
          {feed.map((event) => {
            const Icon = event.icon;
            return (
              <li key={event.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-500/10 text-accent-700 dark:text-accent-500">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">{event.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(event.at, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      </ChartCard>
    </section>
  );
}
