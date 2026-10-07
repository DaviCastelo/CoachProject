import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Settings } from 'lucide-react';
import { requireRole } from '@/lib/auth/guards';
import { PageContainer } from '@/components/page-container';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format-money';
import { listPendingInvoices, listUninvoicedRegistrations, getNotificationQueue } from './actions';
import { AgingSummary } from './aging-summary';
import { Uninvoiced } from './uninvoiced';
import { PendingList } from './pending-list';
import { StatementImport } from './statement-import';
import { NotificationQueuePanel } from './notification-queue';

/**
 * Centro de cobrança.
 *
 * Reúne as quatro coisas que o cliente faz com dinheiro, na ordem em que
 * elas acontecem: ver quanto está atrasado, emitir o que falta cobrar,
 * importar o extrato e dar baixa no resto.
 */

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('payments');
  const locale = await getLocale();

  const [invoices, uninvoiced, queue] = await Promise.all([
    listPendingInvoices(),
    listUninvoicedRegistrations(),
    getNotificationQueue(),
  ]);

  const totalCents = invoices.reduce((sum, invoice) => sum + invoice.dueCents, 0);
  const canConfigure = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <PageContainer className="space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          {invoices.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              {t('headerSummary', {
                count: invoices.length,
                amount: formatMoney(totalCents, locale),
              })}
            </p>
          ) : null}
        </div>

        {canConfigure ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/coach/payments/settings">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t('settingsLink')}
            </Link>
          </Button>
        ) : null}
      </header>

      <AgingSummary invoices={invoices} />

      <Uninvoiced registrations={uninvoiced} />

      <StatementImport />

      <PendingList invoices={invoices} />

      <NotificationQueuePanel queue={queue} />
    </PageContainer>
  );
}
