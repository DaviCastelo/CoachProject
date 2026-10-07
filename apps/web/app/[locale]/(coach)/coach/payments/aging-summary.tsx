import { getTranslations, getLocale } from 'next-intl/server';
import { summarizeAging, AGING_BUCKETS, type AgingInput } from '@ca-tempo/domain';
import { AthleticCard } from '@/components/athletic-card';
import { formatMoney } from '@/lib/format-money';

/**
 * Relatório de inadimplência por faixa de atraso.
 *
 * Uma lista plana não responde a pergunta que importa: $8.000 em aberto pode
 * ser tudo de ontem ou tudo de três meses atrás, e são situações
 * completamente diferentes. Aqui o cliente vê de um olho quanto já venceu e
 * há quanto tempo.
 */
export async function AgingSummary({ invoices }: { invoices: readonly AgingInput[] }) {
  const t = await getTranslations('payments');
  const locale = await getLocale();

  if (invoices.length === 0) return null;

  const report = summarizeAging(invoices);

  return (
    <AthleticCard className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{t('agingTitle')}</h2>
        {report.overdueCount > 0 ? (
          <p className="text-sm text-warning">
            {t('agingOverdue', {
              count: report.overdueCount,
              amount: formatMoney(report.overdueCents, locale),
            })}
          </p>
        ) : (
          <p className="text-sm text-success">{t('agingAllCurrent')}</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AGING_BUCKETS.map((bucket) => {
          const data = report.buckets[bucket];
          const empty = data.count === 0;
          return (
            <div
              key={bucket}
              className={`rounded-card border p-3 ${
                empty
                  ? 'border-border'
                  : bucket === 'current'
                    ? 'border-border'
                    : bucket === 'd31_plus'
                      ? 'border-danger/40'
                      : 'border-warning/40'
              }`}
            >
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`aging_${bucket}`)}
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {formatMoney(data.cents, locale)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {t('agingCount', { count: data.count })}
              </dd>
            </div>
          );
        })}
      </dl>
    </AthleticCard>
  );
}
