import { getTranslations, getLocale } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { PageContainer } from '@/components/page-container';
import { formatMoney } from '@/lib/format-money';
import { listPendingInvoices } from './actions';
import { PendingList } from './pending-list';
import { StatementImport } from './statement-import';

/**
 * Baixa manual de pagamentos (Venmo, dinheiro, cheque, Zelle).
 *
 * Existe porque o Venmo não tem API de cobrança: alguém precisa dizer ao
 * sistema que o dinheiro chegou. O ganho aqui é fazer isso em lote, ou pelo
 * extrato, em vez de uma fatura por vez — na semana que abre um camp são 60
 * a 80 pagamentos em poucos dias.
 */

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('payments');
  const locale = await getLocale();
  const invoices = await listPendingInvoices();

  const totalCents = invoices.reduce((sum, invoice) => sum + invoice.dueCents, 0);

  return (
    <PageContainer className="space-y-6 py-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        {invoices.length > 0 ? (
          <p className="mt-1 text-muted-foreground">
            {t('headerSummary', {
              count: invoices.length,
              amount: formatMoney(totalCents, locale),
            })}
          </p>
        ) : null}
      </header>

      <StatementImport />

      <PendingList invoices={invoices} />
    </PageContainer>
  );
}
