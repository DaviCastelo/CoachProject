import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format-datetime';
import { formatMoney } from '@/lib/format-money';
import type { FamilyPaymentState } from '@/lib/family/registration-state';
import { listFamilyRegistrations } from './load';

export const dynamic = 'force-dynamic';

const BADGE: Record<FamilyPaymentState, 'success' | 'warning' | 'danger' | 'secondary' | 'outline'> = {
  paid: 'success',
  processing: 'warning',
  open: 'warning',
  void: 'secondary',
  refunded: 'secondary',
  pending: 'outline',
  waitlisted: 'outline',
  rejected: 'danger',
  canceled: 'secondary',
  unbilled: 'outline',
};

export default async function FamilyRegistrationsPage() {
  const t = await getTranslations('family');
  const locale = await getLocale();
  const items = await listFamilyRegistrations();

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">{t('myRegistrations')}</h1>
        <p className="text-sm text-muted-foreground">{t('myRegistrationsSubtitle')}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          namespace="family"
          titleKey="noRegistrations"
          descriptionKey="noRegistrationsBody"
          iconName="clipboard"
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const title = item.programName || item.memo || formatDate(item.createdAt, locale);
            const showPartial =
              item.paidCents > 0 &&
              item.totalCents !== null &&
              (item.state === 'open' || item.state === 'processing');

            return (
              <AthleticCard key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{title}</p>
                    {item.optionName ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.optionName}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={BADGE[item.state]}>{t(`regStatus_${item.state}`)}</Badge>
                      {item.athleteName ? (
                        <Badge variant="secondary">{item.athleteName}</Badge>
                      ) : null}
                    </div>
                  </div>
                  {item.amountCents !== null ? (
                    <p className="text-xl font-semibold tabular-nums">
                      {formatMoney(item.amountCents, locale, item.currency)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>{t('registeredOn', { date: formatDate(item.createdAt, locale) })}</p>
                  {item.invoiceNumber ? (
                    <p>{t('invoiceNumber', { number: item.invoiceNumber })}</p>
                  ) : null}
                  {showPartial && item.totalCents !== null ? (
                    <p>
                      {t('partialPaid', {
                        paid: formatMoney(item.paidCents, locale, item.currency),
                        total: formatMoney(item.totalCents, locale, item.currency),
                      })}
                    </p>
                  ) : null}
                  {item.dueOn ? (
                    <p>{t('registrationDueOn', { date: formatDate(item.dueOn, locale) })}</p>
                  ) : null}
                </div>

                {item.canPay && item.invoiceId ? (
                  <Button asChild className="mt-4">
                    <Link href={`/pay/${item.invoiceId}`}>{t('payAction')}</Link>
                  </Button>
                ) : null}
              </AthleticCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
