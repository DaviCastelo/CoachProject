import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { AthleticCard } from '@/components/athletic-card';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import { formatMoney, centsToAmount } from '@/lib/format-money';
import { formatDate } from '@/lib/format-datetime';

/**
 * Instruções de pagamento offline (Venmo, dinheiro, cheque, Zelle).
 *
 * É para onde o OfflineGateway manda a família. Como ela acaba de preencher
 * uma inscrição pública e NÃO está logada, a página é aberta: o UUID da
 * fatura na URL é a credencial, mesmo modelo das páginas de fatura hospedada
 * da Stripe. Por isso ela expõe o mínimo — valor, número e primeiro nome do
 * atleta — e nada de dado sensível nem de outras faturas da família.
 */

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; invoiceId: string }>;
};

type OfflineSettings = {
  venmo_handle?: string;
  note?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaymentInstructionsPage({ params }: PageProps) {
  const { locale, invoiceId } = await params;
  const t = await getTranslations('pay');

  // Um id malformado nunca chega ao banco: evita erro de cast virar 500.
  if (!UUID.test(invoiceId)) notFound();

  const svc = createServiceClient();

  const { data: invoice } = await svc
    .from('invoices')
    .select('id, organization_id, number, status, currency, total_cents, due_on, memo, athlete_id')
    .eq('id', invoiceId)
    .maybeSingle();

  // `draft` ainda não foi enviada a ninguém: tratar como inexistente, em vez
  // de deixar um rascunho de cobrança vazar por link adivinhado.
  if (!invoice || invoice.status === 'draft') notFound();

  const [{ data: balance }, { data: org }, { data: athlete }, { data: settings }] =
    await Promise.all([
      svc
        .from('invoice_balances')
        .select('paid_cents, balance_cents')
        .eq('invoice_id', invoice.id)
        .maybeSingle(),
      svc.from('organizations').select('name').eq('id', invoice.organization_id).maybeSingle(),
      invoice.athlete_id
        ? svc.from('athletes').select('first_name').eq('id', invoice.athlete_id).maybeSingle()
        : Promise.resolve({ data: null }),
      svc
        .from('org_settings')
        .select('value')
        .eq('organization_id', invoice.organization_id)
        .eq('key', 'payments.offline')
        .maybeSingle(),
    ]);

  const offline = (settings?.value ?? {}) as OfflineSettings;
  const venmoHandle = offline.venmo_handle?.replace(/^@/, '') ?? null;

  const paid = balance?.paid_cents ?? 0;
  const due = balance?.balance_cents ?? invoice.total_cents;
  const isPaid = invoice.status === 'paid' || due <= 0;
  const isVoid = invoice.status === 'void' || invoice.status === 'uncollectible';
  const isRefunded = invoice.status === 'refunded';
  const isPartial = !isPaid && paid > 0;

  // O texto que vai na observação do Venmo. É ele que transforma a
  // conferência manual de "quem será que mandou esses $600?" em um
  // casamento direto com a fatura.
  // Hífen simples, não travessão: se o link do Venmo falhar, esse texto é
  // digitado à mão no celular, e travessão não está no teclado.
  const noteText = athlete?.first_name
    ? `${invoice.number} - ${athlete.first_name}`
    : invoice.number;

  // Link que abre o app do Venmo já com destinatário, valor e observação
  // preenchidos. Se o app não estiver instalado, cai no site do Venmo; e o @
  // segue visível na tela abaixo como caminho manual.
  const venmoUrl = venmoHandle
    ? `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(venmoHandle)}` +
      `&amount=${centsToAmount(due)}&note=${encodeURIComponent(noteText)}`
    : null;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-eyebrow text-accent-700 dark:text-accent-500">{org?.name}</p>
      {/* Numa fatura já resolvida, "Conclua seu pagamento" contradiz o que
          aparece logo abaixo. O título acompanha o estado. */}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {isPaid || isVoid || isRefunded ? t('titleDone') : t('title')}
      </h1>

      <AthleticCard className="mt-6 p-5">
        <dl className="space-y-1">
          <dt className="sr-only">{t('amountLabel')}</dt>
          <dd className="text-4xl font-semibold tabular-nums">
            {formatMoney(isPaid ? invoice.total_cents : due, locale, invoice.currency)}
          </dd>
          <dt className="sr-only">{t('invoiceLabel')}</dt>
          <dd className="text-sm text-muted-foreground">
            {t('invoiceNumber', { number: invoice.number })}
            {invoice.memo ? ` · ${invoice.memo}` : ''}
          </dd>
        </dl>

        {isPartial ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('partial', {
              paid: formatMoney(paid, locale, invoice.currency),
              total: formatMoney(invoice.total_cents, locale, invoice.currency),
            })}
          </p>
        ) : null}

        {invoice.due_on && !isPaid && !isVoid ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('dueOn', { date: formatDate(invoice.due_on, locale) })}
          </p>
        ) : null}
      </AthleticCard>

      {isPaid ? (
        <AthleticCard className="mt-4 p-5">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            {t('paidTitle')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{t('paidBody')}</p>
        </AthleticCard>
      ) : isVoid || isRefunded ? (
        <AthleticCard className="mt-4 p-5">
          <p className="flex items-center gap-2 font-medium">
            <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {isRefunded ? t('refundedTitle') : t('voidTitle')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRefunded ? t('refundedBody') : t('voidBody')}
          </p>
        </AthleticCard>
      ) : (
        <>
          {venmoHandle ? (
            <AthleticCard className="mt-4 p-5">
              <h2 className="font-medium">{t('venmoTitle')}</h2>

              {venmoUrl ? (
                <Button asChild className="mt-4 w-full">
                  <a href={venmoUrl} target="_blank" rel="noopener noreferrer">
                    {t('venmoOpen', { amount: formatMoney(due, locale, invoice.currency) })}
                  </a>
                </Button>
              ) : null}

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t('venmoHandleLabel')}</span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono">@{venmoHandle}</code>
                    <CopyButton value={`@${venmoHandle}`} label={t('venmoHandleLabel')} />
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t('noteLabel')}</span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono">{noteText}</code>
                    <CopyButton value={noteText} label={t('noteLabel')} />
                  </span>
                </div>
              </div>

              <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t('noteWhy')}
              </p>
            </AthleticCard>
          ) : null}

          <AthleticCard className="mt-4 p-5">
            <h2 className="font-medium">{t('otherTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {offline.note ?? t('otherBody')}
            </p>
          </AthleticCard>

          <p className="mt-4 text-sm text-muted-foreground">{t('confirmDelay')}</p>
        </>
      )}
    </main>
  );
}
