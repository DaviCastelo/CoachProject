import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format-money';
import { formatDate } from '@/lib/format-datetime';
import { startCheckout } from './actions';

/**
 * Escolha do meio de pagamento (documento 07 §4).
 *
 * Página pública, sem login: o UUID da fatura é a credencial. Renderizada no
 * servidor, com `radio` nativo e `peer-checked` para o estado selecionado —
 * zero JavaScript no cliente. Tela de pagamento aberta no 4G do
 * estacionamento do campo não pode depender de hidratação.
 */

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; invoiceId: string }>;
  searchParams: Promise<{ done?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Option = {
  value: string;
  title: string;
  body: string;
  recommended?: boolean;
};

export default async function PayPage({ params, searchParams }: PageProps) {
  const { locale, invoiceId } = await params;
  const { done } = await searchParams;
  const t = await getTranslations('pay');

  if (!UUID.test(invoiceId)) notFound();

  const svc = createServiceClient();

  const { data: invoice } = await svc
    .from('invoices')
    .select('id, organization_id, number, status, currency, total_cents, due_on, memo')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice || invoice.status === 'draft') notFound();

  const [{ data: balance }, { data: org }] = await Promise.all([
    svc
      .from('invoice_balances')
      .select('paid_cents, pending_cents, balance_cents')
      .eq('invoice_id', invoice.id)
      .maybeSingle(),
    svc.from('organizations').select('name').eq('id', invoice.organization_id).maybeSingle(),
  ]);

  const paid = balance?.paid_cents ?? 0;
  const pending = balance?.pending_cents ?? 0;
  const due = balance?.balance_cents ?? invoice.total_cents;

  const isPaid = invoice.status === 'paid' || due <= 0;
  const isVoid = invoice.status === 'void' || invoice.status === 'uncollectible';
  const isRefunded = invoice.status === 'refunded';
  const isPending = !isPaid && pending > 0;
  const canPay = !isPaid && !isVoid && !isRefunded && !isPending;

  const options: Option[] = [
    { value: 'bank', title: t('bankTitle'), body: t('bankBody'), recommended: true },
    { value: 'card', title: t('cardTitle'), body: t('cardBody') },
    { value: 'cash_app', title: t('cashAppTitle'), body: t('cashAppBody') },
  ];

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-eyebrow text-accent-700 dark:text-accent-500">{org?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {canPay ? t('title') : t('titleDone')}
      </h1>

      <AthleticCard className="mt-6 p-5">
        <p className="text-4xl font-semibold tabular-nums">
          {formatMoney(isPaid ? invoice.total_cents : due, locale, invoice.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('invoiceNumber', { number: invoice.number })}
          {invoice.memo ? ` · ${invoice.memo}` : ''}
        </p>
        {paid > 0 && !isPaid ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('partial', {
              paid: formatMoney(paid, locale, invoice.currency),
              total: formatMoney(invoice.total_cents, locale, invoice.currency),
            })}
          </p>
        ) : null}
        {invoice.due_on && canPay ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('dueOn', { date: formatDate(invoice.due_on, locale) })}
          </p>
        ) : null}
      </AthleticCard>

      {isPaid ? (
        <StatusCard tone="success" title={t('paidTitle')} body={t('paidBody')} />
      ) : isPending ? (
        // ACH leva de 3 a 5 dias para compensar. Enquanto isso não é "pago"
        // nem "em aberto": dizer qualquer um dos dois geraria pagamento em
        // duplicidade ou ligação para o coach.
        <StatusCard tone="pending" title={t('processingTitle')} body={t('processingBody')} />
      ) : isVoid || isRefunded ? (
        <StatusCard
          tone="neutral"
          title={isRefunded ? t('refundedTitle') : t('voidTitle')}
          body={isRefunded ? t('refundedBody') : t('voidBody')}
        />
      ) : (
        <>
          {done ? (
            // Voltou da Stripe, mas o webhook pode levar alguns segundos. Sem
            // este aviso a pessoa vê "em aberto" logo após pagar e paga de novo.
            <StatusCard tone="pending" title={t('doneTitle')} body={t('doneBody')} />
          ) : null}

          <form action={startCheckout} className="mt-4 space-y-3">
            <input type="hidden" name="invoiceId" value={invoice.id} />

            <fieldset className="space-y-3">
              <legend className="sr-only">{t('chooseLegend')}</legend>

              {options.map((option, index) => (
                <label
                  key={option.value}
                  // Hover mexe no FUNDO, seleção manda na BORDA. Quando os
                  // dois disputavam `border-color`, passar o mouse sobre a
                  // opção já escolhida apagava o dourado dela.
                  //
                  // O anel de foco fica no card porque o input é sr-only:
                  // sem isso quem navega por teclado não enxerga onde está.
                  className="block cursor-pointer rounded-card border border-border bg-card p-4 transition-colors hover:bg-muted/40 has-[:checked]:border-accent-500 has-[:checked]:bg-accent-500/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background"
                >
                  {/* O input precisa ser IRMÃO anterior do círculo: `peer-*`
                      só alcança irmãos posteriores, não descendentes de
                      irmãos. Com o input fora deste flex, o círculo nunca
                      mudava e só a borda do card reagia à seleção. */}
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="method"
                      value={option.value}
                      defaultChecked={index === 0}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-ink-400 peer-checked:border-[5px] peer-checked:border-accent-500 dark:border-ink-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{option.title}</span>
                        {option.recommended ? (
                          <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-950">
                            {t('recommended')}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {option.body}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Button type="submit" size="lg" className="w-full">
              {t('continueAction', {
                amount: formatMoney(due, locale, invoice.currency),
              })}
            </Button>
          </form>

          <AthleticCard className="mt-4 p-5">
            <h2 className="font-medium">{t('offlineTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('offlineBody')}</p>
            <Button asChild variant="outline" className="mt-3">
              <Link href={`/pay/${invoice.id}/instructions`}>{t('offlineAction')}</Link>
            </Button>
          </AthleticCard>
        </>
      )}
    </main>
  );
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: 'success' | 'pending' | 'neutral';
  title: string;
  body: string;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'pending' ? Clock : XCircle;
  const color =
    tone === 'success' ? 'text-success' : tone === 'pending' ? 'text-warning' : 'text-muted-foreground';

  return (
    <AthleticCard className="mt-4 p-5">
      <p className={`flex items-center gap-2 font-medium ${color}`}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </AthleticCard>
  );
}
