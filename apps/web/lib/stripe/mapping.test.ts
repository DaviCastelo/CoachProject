import type Stripe from 'stripe';
import { describe, it, expect } from 'vitest';
import {
  METHOD_TO_STRIPE,
  stripeMethodToOurs,
  mapStatus,
  asCharge,
  feeFromCharge,
  currencyMatches,
} from './mapping';

/*
 * Estas funções são pequenas e decidem coisas grandes: se uma vaga é liberada
 * antes do dinheiro existir, e quanto o clube recebeu de verdade.
 *
 * Até aqui elas só tinham sido provadas por um teste ao vivo contra a Stripe,
 * que vale muito no dia e não pega regressão nenhuma depois.
 */

/** PaymentIntent mínimo: só os campos que o mapeamento olha. */
function intent(
  status: Stripe.PaymentIntent.Status,
  lastPaymentError?: Partial<Stripe.PaymentIntent.LastPaymentError>,
): Stripe.PaymentIntent {
  return { status, last_payment_error: lastPaymentError } as Stripe.PaymentIntent;
}

function charge(fields: Partial<Stripe.Charge>): Stripe.Charge {
  return fields as Stripe.Charge;
}

describe('mapStatus — status da Stripe vira o nosso', () => {
  // A asserção mais importante do arquivo. No ACH o intent fica em
  // `processing` por dias e AINDA PODE falhar por falta de saldo. Se isso
  // virasse 'succeeded', a fatura fecharia e a vaga seria liberada com o
  // dinheiro ainda em trânsito.
  it('processing vira pending, nunca succeeded', () => {
    expect(mapStatus(intent('processing'))).toBe('pending');
  });

  it('succeeded vira succeeded', () => {
    expect(mapStatus(intent('succeeded'))).toBe('succeeded');
  });

  it('canceled vira canceled', () => {
    expect(mapStatus(intent('canceled'))).toBe('canceled');
  });

  // `requires_payment_method` é ambíguo: é o estado de um intent recém-criado
  // que ninguém pagou E o de um que acabou de ter o cartão recusado. O que
  // separa os dois é o last_payment_error.
  it('requires_payment_method COM erro anterior é falha', () => {
    expect(mapStatus(intent('requires_payment_method', { code: 'card_declined' }))).toBe(
      'failed',
    );
  });

  it('requires_payment_method SEM erro é só um intent que ninguém pagou ainda', () => {
    expect(mapStatus(intent('requires_payment_method'))).toBe('pending');
  });

  it.each<Stripe.PaymentIntent.Status>([
    'requires_confirmation',
    'requires_action',
    'requires_capture',
  ])('%s vira pending', (status) => {
    expect(mapStatus(intent(status))).toBe('pending');
  });

  // Se a Stripe inventar um status novo, o padrão seguro é não dar o dinheiro
  // por recebido.
  it('status desconhecido cai em pending, não em succeeded', () => {
    expect(mapStatus(intent('status_que_nao_existe' as Stripe.PaymentIntent.Status))).toBe(
      'pending',
    );
  });
});

describe('stripeMethodToOurs — como a família pagou', () => {
  it('sem cobrança anexada, não dá para saber o método', () => {
    expect(stripeMethodToOurs(null)).toBe('other');
  });

  it('conta bancária (ACH)', () => {
    expect(stripeMethodToOurs(charge({ payment_method_details: { type: 'us_bank_account' } as Stripe.Charge.PaymentMethodDetails }))).toBe('us_bank_account');
  });

  // Repara na diferença de grafia: a Stripe escreve `cashapp`, o nosso enum
  // escreve `cash_app`. Trocar um pelo outro grava o método errado.
  it('Cash App: `cashapp` da Stripe vira `cash_app` nosso', () => {
    expect(stripeMethodToOurs(charge({ payment_method_details: { type: 'cashapp' } as Stripe.Charge.PaymentMethodDetails }))).toBe('cash_app');
  });

  it('cartão comum', () => {
    expect(
      stripeMethodToOurs(
        charge({ payment_method_details: { type: 'card', card: {} } as Stripe.Charge.PaymentMethodDetails }),
      ),
    ).toBe('card');
  });

  // Carteira digital chega como cartão com um rótulo dentro. Sem olhar o
  // rótulo, o relatório diria que ninguém usa Apple Pay.
  it.each([
    ['apple_pay', 'apple_pay'],
    ['google_pay', 'google_pay'],
    ['link', 'link'],
  ])('cartão com carteira %s é registrado como %s', (wallet, esperado) => {
    expect(
      stripeMethodToOurs(
        charge({
          payment_method_details: {
            type: 'card',
            card: { wallet: { type: wallet } },
          } as unknown as Stripe.Charge.PaymentMethodDetails,
        }),
      ),
    ).toBe(esperado);
  });

  it('método que não conhecemos vira `other`, não quebra', () => {
    expect(
      stripeMethodToOurs(
        charge({ payment_method_details: { type: 'boleto' } as unknown as Stripe.Charge.PaymentMethodDetails }),
      ),
    ).toBe('other');
  });
});

describe('feeFromCharge — a taxa real, não a estimada', () => {
  it('sem cobrança não há taxa', () => {
    expect(feeFromCharge(null)).toBeNull();
  });

  // A taxa só existe depois que a transação entra no saldo. Antes disso a
  // Stripe devolve só o id da balance_transaction, sem expandir. Devolver 0
  // aqui seria pior que null: 0 parece uma taxa de verdade.
  it('balance_transaction ainda não expandida devolve null, não zero', () => {
    expect(feeFromCharge(charge({ balance_transaction: 'txn_123' }))).toBeNull();
  });

  it('balance_transaction expandida devolve a taxa em centavos', () => {
    expect(
      feeFromCharge(
        charge({ balance_transaction: { fee: 1770 } as Stripe.BalanceTransaction }),
      ),
    ).toBe(1770);
  });
});

describe('asCharge — a Stripe devolve id ou objeto, depende do expand', () => {
  it('string é só o id, não dá para ler nada dela', () => {
    expect(asCharge('ch_123')).toBeNull();
  });

  it('null e undefined viram null', () => {
    expect(asCharge(null)).toBeNull();
    expect(asCharge(undefined)).toBeNull();
  });

  it('objeto expandido passa direto', () => {
    const c = charge({ id: 'ch_123' });
    expect(asCharge(c)).toBe(c);
  });
});

describe('currencyMatches — o livro é na moeda da fatura', () => {
  it('mesma moeda passa', () => {
    expect(currencyMatches('usd', 'usd')).toBe(true);
  });

  // Visto em produção: com Adaptive Pricing ligado na conta, um checkout
  // aberto do Brasil converteu US$ 1,00 em R$ 5,19. O intent nasceria em
  // `brl` com amount 519, e sem esta checagem 519 centavos de real entrariam
  // numa fatura de 100 centavos de dólar, deixando o saldo em -419.
  it('moeda diferente é recusada', () => {
    expect(currencyMatches('brl', 'usd')).toBe(false);
  });

  it('maiúsculas não enganam', () => {
    expect(currencyMatches('USD', 'usd')).toBe(true);
  });

  it('espaço sobrando não engana', () => {
    expect(currencyMatches(' usd ', 'usd')).toBe(true);
  });
});

describe('METHOD_TO_STRIPE — nossos métodos viram os tipos da Stripe', () => {
  // Apple Pay e Google Pay NÃO são tipos próprios na Stripe: pedir por eles
  // em payment_method_types daria erro na criação da sessão.
  it('as carteiras digitais entram como `card`', () => {
    expect(METHOD_TO_STRIPE.apple_pay).toBe('card');
    expect(METHOD_TO_STRIPE.google_pay).toBe('card');
  });

  it('cash_app vira `cashapp`, sem underscore', () => {
    expect(METHOD_TO_STRIPE.cash_app).toBe('cashapp');
  });

  it('us_bank_account é o nome que a própria Stripe usa para ACH', () => {
    expect(METHOD_TO_STRIPE.us_bank_account).toBe('us_bank_account');
  });

  // Método offline não tem equivalente: a Stripe nem sabe que Venmo existe
  // no nosso sistema. Se algum dia mapear, o checkout ofereceria uma opção
  // que não funciona.
  it.each(['venmo', 'cash', 'check', 'zelle'] as const)(
    '%s não tem equivalente na Stripe',
    (metodo) => {
      expect(METHOD_TO_STRIPE[metodo]).toBeUndefined();
    },
  );
});
