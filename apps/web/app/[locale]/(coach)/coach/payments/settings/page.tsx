import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/guards';
import { PageContainer } from '@/components/page-container';
import { getPaymentSettings } from '../actions';
import { PaymentSettingsForm } from './settings-form';

/**
 * Configuração de pagamento da organização.
 *
 * Antes disto, o @ do Venmo só existia escrevendo direto em `org_settings`
 * no banco. Dívida que eu mesmo criei ao montar a tela de instruções, e que
 * esta página paga.
 *
 * Restrita a owner/admin: quem pode dar baixa e por quanto tempo a vaga
 * fica presa são decisões de quem responde pelo dinheiro.
 */

export const dynamic = 'force-dynamic';

export default async function PaymentSettingsPage() {
  await requireRole(['owner', 'admin']);
  const t = await getTranslations('payments');
  const settings = await getPaymentSettings();

  return (
    <PageContainer className="max-w-2xl space-y-6 py-6">
      <header>
        <Link
          href="/coach/payments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('title')}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('settingsTitle')}</h1>
      </header>

      <PaymentSettingsForm initial={settings} />
    </PageContainer>
  );
}
