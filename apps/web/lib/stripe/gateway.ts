import type Stripe from 'stripe';
import type {
  PaymentGateway,
  CheckoutParams,
  CheckoutSession,
  GatewayPayment,
  RefundResult,
  WebhookEvent,
} from '@ca-tempo/domain';
import { getStripe } from './client';
import {
  METHOD_TO_STRIPE,
  stripeMethodToOurs,
  mapStatus,
  asCharge,
  feeFromCharge,
} from './mapping';

/**
 * Adaptador da Stripe para a interface `PaymentGateway`.
 *
 * Cobre cartão, ACH, Cash App e Link. O que é marcado na mão (Venmo, dinheiro,
 * cheque, Zelle) vive no OfflineGateway — a Stripe não sabe que existe.
 *
 * A tradução pura entre os dois vocabulários mora em `./mapping`, onde dá para
 * testar sem subir rede nem banco.
 */

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
