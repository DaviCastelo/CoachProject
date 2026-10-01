import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { StripeGateway } from '@/lib/stripe/gateway';

/**
 * Webhook da Stripe.
 *
 * É o único caminho pelo qual uma fatura é quitada automaticamente, então o
 * cuidado aqui é diferente do resto do app. Duas regras governam o arquivo:
 *
 *  1. Nada é processado sem assinatura válida. Quem descobrir esta URL e mandar
 *     um POST não consegue marcar nada como pago.
 *  2. Evento repetido não pode cobrar duas vezes. A Stripe REENVIA quando não
 *     recebe 200 rápido, e reenvia de novo por dias se continuar falhando.
 *     A trava é o unique (provider, event_id) em webhook_events, com o
 *     on conflict de apply_stripe_payment como segunda linha de defesa.
 */

// O SDK da Stripe precisa de Node, não roda no edge. E a rota nunca pode ser
// pré-renderizada: ela existe só para receber POST.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Eventos que realmente mexem em dinheiro. O resto é gravado e ignorado. */
const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
]);

export async function POST(request: Request): Promise<Response> {
  // Corpo CRU: a assinatura é calculada sobre os bytes exatos. Qualquer
  // reserialização (request.json() e depois stringify) invalida a conferência.
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return Response.json({ error: 'missing signature' }, { status: 400 });
  }

  const gateway = new StripeGateway();

  let event: Stripe.Event;
  try {
    event = gateway.verifyWebhook(raw, signature).payload as Stripe.Event;
  } catch (error) {
    // 400 de propósito: assinatura inválida não deve virar retentativa, porque
    // reenviar não vai consertar uma chave errada nem um payload forjado.
    console.error('[stripe-webhook] assinatura inválida', error);
    return Response.json({ error: 'invalid signature' }, { status: 400 });
  }

  const db = createServiceClient() as unknown as SupabaseClient;

  // Trava de idempotência. Se o insert colidir, este evento já foi recebido:
  // devolvemos 200 e paramos, sem reprocessar.
  const { error: insertError } = await db.from('webhook_events').insert({
    provider: 'stripe',
    event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return Response.json({ received: true, duplicate: true });
    }
    // Não conseguimos registrar: devolvemos 500 para a Stripe reenviar. Melhor
    // reprocessar depois do que perder a confirmação de um pagamento.
    console.error('[stripe-webhook] falha ao gravar evento', insertError);
    return Response.json({ error: 'persist failed' }, { status: 500 });
  }

  try {
    if (HANDLED.has(event.type)) {
      await handleEvent(db, gateway, event);
    }

    await db
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);

    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-webhook] falha ao processar', event.type, message);

    // Guarda o motivo na própria linha: sem isso, um evento que falhou vira
    // um pagamento perdido que ninguém consegue investigar depois.
    await db
      .from('webhook_events')
      .update({ error: message })
      .eq('provider', 'stripe')
      .eq('event_id', event.id);

    // 500 para a Stripe reenviar. Como processed_at continua nulo e o
    // apply_stripe_payment é idempotente, reprocessar é seguro.
    return Response.json({ error: 'processing failed' }, { status: 500 });
  }
}

async function handleEvent(
  db: SupabaseClient,
  gateway: StripeGateway,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const intentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      // No ACH a sessão completa ANTES do dinheiro liquidar: o
      // payment_intent fica em processing por dias. Por isso a fonte da
      // verdade é sempre o PaymentIntent, nunca o status da sessão.
      if (intentId) {
        await applyIntent(db, gateway, intentId, session.metadata?.invoice_id);
      }
      return;
    }

    case 'payment_intent.succeeded':
    case 'payment_intent.processing':
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await applyIntent(db, gateway, intent.id, intent.metadata?.invoice_id);
      return;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) return;

      const { data: payment } = await db
        .from('payments')
        .select('id, organization_id, amount_cents')
        .eq('provider', 'stripe')
        .eq('external_id', intentId)
        .maybeSingle();

      if (!payment) return;

      const refunded = charge.amount_refunded;
      const total = charge.amount;

      await db.from('refunds').insert({
        organization_id: payment.organization_id,
        payment_id: payment.id,
        amount_cents: refunded,
        external_id: `${charge.id}:${refunded}`,
        status: 'refunded',
        reason: 'stripe',
      });

      await db
        .from('payments')
        .update({
          status: refunded >= total ? 'refunded' : 'partially_refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      return;
    }

    case 'charge.dispute.created': {
      // Nada automático aqui de propósito. Contestação custa $15 e exige
      // alguém olhando: o evento fica gravado em webhook_events e a tela de
      // faturas mostra o alerta. Mexer na fatura sozinho só confundiria.
      return;
    }

    default:
      return;
  }
}

/**
 * Relê o PaymentIntent na Stripe em vez de confiar no corpo do evento.
 *
 * Dois motivos: eventos chegam fora de ordem (um `processing` atrasado pode
 * chegar depois do `succeeded` e rebaixar o status), e a taxa real só existe
 * depois que a transação entra no saldo, o que exige expandir a cobrança.
 */
async function applyIntent(
  db: SupabaseClient,
  gateway: StripeGateway,
  intentId: string,
  invoiceIdFromMetadata: string | undefined,
): Promise<void> {
  const payment = await gateway.getPayment(intentId);
  if (!payment) {
    throw new Error(`PaymentIntent ${intentId} não encontrado na Stripe`);
  }

  const invoiceId = invoiceIdFromMetadata ?? (await findInvoiceId(db, intentId));
  if (!invoiceId) {
    // Pagamento sem fatura é dinheiro órfão: alguém precisa conciliar na mão.
    throw new Error(`PaymentIntent ${intentId} chegou sem invoice_id no metadata`);
  }

  const { error } = await db.rpc('apply_stripe_payment', {
    p_invoice_id: invoiceId,
    p_external_id: payment.externalId,
    p_method: payment.method,
    p_status: payment.status,
    p_amount_cents: payment.amountCents,
    p_fee_cents: payment.feeCents,
    p_paid_at: payment.paidAt,
    p_failure_reason: payment.failureReason,
  });

  if (error) {
    throw new Error(`apply_stripe_payment falhou: ${error.message}`);
  }
}

/** Reenvio de um pagamento que já gravamos: a fatura está na nossa tabela. */
async function findInvoiceId(db: SupabaseClient, intentId: string): Promise<string | null> {
  const { data } = await db
    .from('payments')
    .select('invoice_id')
    .eq('provider', 'stripe')
    .eq('external_id', intentId)
    .maybeSingle();

  return data?.invoice_id ?? null;
}
