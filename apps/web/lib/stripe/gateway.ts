import type Stripe from 'stripe';
import type {
  PaymentGateway,
  CheckoutParams,
  CheckoutSession,
  GatewayPayment,
  RefundResult,
  WebhookEvent,
  PaymentMethod,
  PaymentStatus,
} from '@ca-tempo/domain';
import { getStripe } from './client';

/**
 * Adaptador da Stripe para a interface `PaymentGateway`.
 *
 * Cobre cartão, ACH, Cash App e Link. O que é marcado na mão (Venmo, dinheiro,
 * cheque, Zelle) vive no OfflineGateway — a Stripe não sabe que existe.
 */

/**
 * Nossos métodos → os tipos que a Stripe aceita em `payment_method_types`.
 *
 * `apple_pay` e `google_pay` NÃO são tipos próprios na Stripe: eles chegam
 * dentro de `card`. Por isso mapeiam para 'card' e são deduplicados depois.
 */
const METHOD_TO_STRIPE: Partial<Record<PaymentMethod, Stripe.Checkout.SessionCreateParams.PaymentMethodType>> = {
  card: 'card',
  us_bank_account: 'us_bank_account',
  cash_app: 'cashapp',
  link: 'link',
  apple_pay: 'card',
  google_pay: 'card',
};

/** Caminho de volta: o que a Stripe informou no pagamento → nosso enum. */
function stripeMethodToOurs(charge: Stripe.Charge | null): PaymentMethod {
  const details = charge?.payment_method_details;
  if (!details) return 'other';

  switch (details.type) {
    case 'us_bank_account':
      return 'us_bank_account';
    case 'cashapp':
      return 'cash_app';
    case 'link':
      return 'link';
    case 'card': {
      // Carteira digital chega como cartão com um rótulo dentro.
      const wallet = details.card?.wallet?.type;
      if (wallet === 'apple_pay') return 'apple_pay';
      if (wallet === 'google_pay') return 'google_pay';
      if (wallet === 'link') return 'link';
      return 'card';
    }
    default:
      return 'other';
  }
}

/**
 * Status da Stripe → nosso enum.
 *
 * O caso que importa é o ACH: ele fica em `processing` por dias e só depois
 * vira succeeded ou falha por falta de saldo. Mapear `processing` para
 * 'pending' é o que impede o sistema de liberar uma vaga antes do dinheiro
 * existir de verdade.
 */
function mapStatus(intent: Stripe.PaymentIntent): PaymentStatus {
  switch (intent.status) {
    case 'succeeded':
      return 'succeeded';
    case 'processing':
      return 'pending';
    case 'canceled':
      return 'canceled';
    case 'requires_payment_method':
      // Depois de uma tentativa frustrada a Stripe devolve o intent a este
      // estado. Sem o `last_payment_error` seria indistinguível de um intent
      // recém-criado que ninguém pagou ainda.
      return intent.last_payment_error ? 'failed' : 'pending';
    case 'requires_confirmation':
    case 'requires_action':
    case 'requires_capture':
      return 'pending';
    default:
      return 'pending';
  }
}

function asCharge(value: string | Stripe.Charge | null | undefined): Stripe.Charge | null {
  return value && typeof value !== 'string' ? value : null;
}

/** A taxa real só existe depois que a transação entra no saldo. Antes é null. */
function feeFromCharge(charge: Stripe.Charge | null): number | null {
  const tx = charge?.balance_transaction;
  if (!tx || typeof tx === 'string') return null;
  return tx.fee;
}

export class StripeGateway implements PaymentGateway {
  readonly provider = 'stripe' as const;

  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    const stripe = getStripe();

    // A ordem é preservada, e é ela que coloca o ACH na frente do cartão.
    // Sem `payment_method_types` explícito a Stripe decide sozinha ("dynamic
    // payment methods") e pode muito bem mostrar cartão primeiro — o que
    // apagaria a economia inteira do projeto.
    const types = [
      ...new Set(
        params.methods
          .map((m) => METHOD_TO_STRIPE[m])
          .filter((t): t is Stripe.Checkout.SessionCreateParams.PaymentMethodType => Boolean(t)),
      ),
    ];

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: types.length > 0 ? types : ['card'],

        // A conta vem com Adaptive Pricing LIGADO por padrão, e ninguém na CA
        // Tempo escolheu isso: a Stripe ativa sozinha em contas elegíveis.
        // Com ele, quem abre o checkout de fora dos EUA recebe o preço
        // convertido e o PaymentIntent nasce na moeda do visitante.
        //
        // Visto na prática num teste em produção: fatura de US$ 1,00 virou
        // "R$ 5,19" já pré-selecionado, e o `intent.amount` seria 519. Como o
        // nosso livro inteiro é em centavos da moeda da FATURA, isso gravaria
        // 519 contra um total de 100 e deixaria o saldo em -419, sem erro
        // nenhum na tela.
        //
        // Desligar não prejudica família estrangeira: ela paga em dólar e a
        // conversão fica com o banco dela, sem o spread da Stripe em cima.
        adaptive_pricing: { enabled: false },

        payment_method_options: {
          us_bank_account: {
            financial_connections: {
              // Conecta o banco na hora, em vez de esperar dias pelos
              // microdepósitos de confirmação (metade das pessoas desiste ali).
              permissions: ['payment_method'],
            },
          },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.currency,
              unit_amount: params.amountCents,
              product_data: { name: params.description },
            },
          },
        ],
        customer_email: params.customerEmail,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        // Metadata vai e volta: é por aqui que o webhook sabe qual fatura
        // quitar. Sem isso o pagamento chega órfão.
        metadata: {
          ...params.metadata,
          invoice_id: params.invoiceId,
          organization_id: params.organizationId,
        },
        payment_intent_data: {
          metadata: {
            invoice_id: params.invoiceId,
            organization_id: params.organizationId,
          },
        },
      },
      {
        // Duplo clique no botão não pode virar duas sessões de cobrança.
        idempotencyKey: `checkout:${params.invoiceId}:${params.amountCents}`,
      },
    );

    if (!session.url) {
      throw new Error(`Stripe devolveu sessão ${session.id} sem URL de checkout`);
    }

    return {
      id: session.id,
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  }

  async getPayment(externalId: string): Promise<GatewayPayment | null> {
    const stripe = getStripe();

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(externalId, {
        expand: ['latest_charge.balance_transaction'],
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'resource_missing'
      ) {
        return null;
      }
      throw error;
    }

    const charge = asCharge(intent.latest_charge);
    const status = mapStatus(intent);

    return {
      externalId: intent.id,
      status,
      method: stripeMethodToOurs(charge),
      amountCents: intent.amount,
      // Sempre minúsculas na Stripe, mas normalizamos para não depender disso.
      currency: intent.currency.toLowerCase(),
      feeCents: feeFromCharge(charge),
      paidAt:
        status === 'succeeded' && charge?.created
          ? new Date(charge.created * 1000).toISOString()
          : null,
      failureReason: intent.last_payment_error?.message ?? null,
    };
  }

  async refund(externalId: string, amountCents?: number): Promise<RefundResult> {
    const stripe = getStripe();

    const refund = await stripe.refunds.create(
      {
        payment_intent: externalId,
        ...(amountCents === undefined ? {} : { amount: amountCents }),
      },
      { idempotencyKey: `refund:${externalId}:${amountCents ?? 'full'}` },
    );

    return {
      externalId: refund.id,
      amountCents: refund.amount,
      status: refund.status === 'succeeded' ? 'refunded' : 'pending',
    };
  }

  verifyWebhook(payload: string, signature: string): WebhookEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    }

    // Sem esta verificação, qualquer um que descubra a URL do webhook marca
    // fatura como paga mandando um POST. Nunca confiar no corpo da requisição.
    const event = getStripe().webhooks.constructEvent(payload, signature, secret);

    return { id: event.id, type: event.type, payload: event };
  }
}
