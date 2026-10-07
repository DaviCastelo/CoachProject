'use server';

import { redirect } from 'next/navigation';
import type { PaymentMethod } from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { StripeGateway } from '@/lib/stripe/gateway';

/**
 * Inicia o checkout da Stripe para uma fatura.
 *
 * Ação pública: a família não está logada, e o UUID da fatura na URL é a
 * credencial. Criar uma sessão de checkout não move dinheiro nem expõe dado
 * de terceiro, então o risco de alguém chamar isso à toa é baixo — ainda
 * assim só aceitamos fatura `open` com saldo, para não gerar cobrança de algo
 * já pago, anulado ou em rascunho.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A ORDEM de cada lista é o que a Stripe respeita no checkout. ACH primeiro
 * não é estética: é a diferença entre $4,80 e $17,70 de taxa num camp de
 * $600. Sem lista explícita a Stripe decide sozinha ("dynamic payment
 * methods") e pode pôr cartão na frente.
 */
const METHOD_SETS: Record<string, readonly PaymentMethod[]> = {
  bank: ['us_bank_account'],
  card: ['card', 'link'],
  cash_app: ['cash_app'],
};

export async function startCheckout(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get('invoiceId') ?? '');
  const choice = String(formData.get('method') ?? 'bank');

  if (!UUID.test(invoiceId)) redirect('/');

  const methods = METHOD_SETS[choice];
  if (!methods) redirect(`/pay/${invoiceId}`);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error('Missing NEXT_PUBLIC_SITE_URL');

  const svc = createServiceClient();

  const { data: invoice } = await svc
    .from('invoices')
    .select('id, organization_id, status, currency, total_cents, memo, number')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice || invoice.status !== 'open') redirect(`/pay/${invoiceId}`);

  const { data: balance } = await svc
    .from('invoice_balances')
    .select('balance_cents, pending_cents')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  const due = balance?.balance_cents ?? invoice.total_cents;

  // Já existe pagamento em compensação (o caso do ACH, que leva dias). Cobrar
  // de novo agora criaria pagamento em duplicidade por impaciência.
  if (due <= 0 || (balance?.pending_cents ?? 0) > 0) redirect(`/pay/${invoiceId}`);

  const gateway = new StripeGateway();
  const session = await gateway.createCheckout({
    invoiceId: invoice.id,
    organizationId: invoice.organization_id,
    amountCents: due,
    currency: invoice.currency,
    description: invoice.memo ?? `Invoice ${invoice.number}`,
    methods,
    successUrl: `${siteUrl}/pay/${invoiceId}?done=1`,
    cancelUrl: `${siteUrl}/pay/${invoiceId}`,
  });

  // Fora de try/catch de propósito: redirect() no Next funciona lançando, e
  // um catch em volta engoliria o redirecionamento.
  redirect(session.url);
}
