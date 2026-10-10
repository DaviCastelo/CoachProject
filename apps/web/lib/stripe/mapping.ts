import type Stripe from 'stripe';
import type { PaymentMethod, PaymentStatus } from '@ca-tempo/domain';

/*
 * Tradução entre o vocabulário da Stripe e o nosso. Zero I/O: nada aqui fala
 * com a rede nem com o banco.
 *
 * Isto morava dentro do `gateway.ts`, grudado na classe que faz as chamadas.
 * Saiu de lá porque é a parte que mais importa acertar e a única que dá para
 * testar sozinha. São funções pequenas que decidem se uma vaga é liberada e
 * quanto o clube pagou de taxa.
 */

/**
 * Nossos métodos → os tipos que a Stripe aceita em `payment_method_types`.
 *
 * `apple_pay` e `google_pay` NÃO são tipos próprios na Stripe: eles chegam
 * dentro de `card`. Por isso mapeiam para 'card' e são deduplicados depois.
 */
export const METHOD_TO_STRIPE: Partial<
  Record<PaymentMethod, Stripe.Checkout.SessionCreateParams.PaymentMethodType>
> = {
  card: 'card',
  us_bank_account: 'us_bank_account',
  cash_app: 'cashapp',
  link: 'link',
  apple_pay: 'card',
  google_pay: 'card',
};

/** Caminho de volta: o que a Stripe informou no pagamento → nosso enum. */
export function stripeMethodToOurs(charge: Stripe.Charge | null): PaymentMethod {
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
export function mapStatus(intent: Stripe.PaymentIntent): PaymentStatus {
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

export function asCharge(
  value: string | Stripe.Charge | null | undefined,
): Stripe.Charge | null {
  return value && typeof value !== 'string' ? value : null;
}

/** A taxa real só existe depois que a transação entra no saldo. Antes é null. */
export function feeFromCharge(charge: Stripe.Charge | null): number | null {
  const tx = charge?.balance_transaction;
  if (!tx || typeof tx === 'string') return null;
  return tx.fee;
}

/**
 * O pagamento veio na mesma moeda da fatura?
 *
 * `amountCents` não significa nada sozinho: 519 é um número bom em centavos de
 * real e um número errado em centavos de dólar. Com Adaptive Pricing ligado na
 * conta, um checkout aberto de fora dos EUA converte sozinho, e sem esta
 * conferência o livro grava a moeda errada sem acusar nada.
 */
export function currencyMatches(paymentCurrency: string, invoiceCurrency: string): boolean {
  return paymentCurrency.trim().toLowerCase() === invoiceCurrency.trim().toLowerCase();
}
