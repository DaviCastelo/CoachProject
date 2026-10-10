import { describe, it, expect } from 'vitest';
import { idempotencyKeyFor } from './idempotency';

/*
 * Este arquivo existe por causa de uma tela de erro em produção.
 *
 * A chave era montada à mão como `checkout:<fatura>:<valor>`, e a Stripe
 * recusa reuso de chave com parâmetros diferentes. Dois cenários quebravam:
 * trocar o método de pagamento, e qualquer deploy que mudasse o corpo da
 * sessão. Os dois davam 400 na cara da família, sem ela ter feito nada.
 */

const fatura = 'deadbeef-0000-0000-0000-000000000002';

/** Um corpo de sessão parecido com o real, só com o que costuma variar. */
function corpo(over: Record<string, unknown> = {}) {
  return {
    mode: 'payment',
    payment_method_types: ['us_bank_account'],
    adaptive_pricing: { enabled: false },
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 100 } }],
    ...over,
  };
}

describe('idempotencyKeyFor', () => {
  it('mesmo pedido gera a mesma chave, que é o que protege do duplo clique', () => {
    expect(idempotencyKeyFor('checkout', fatura, corpo())).toBe(
      idempotencyKeyFor('checkout', fatura, corpo()),
    );
  });

  // O bug que estava em produção. A família escolhia conta bancária, voltava,
  // escolhia cartão, e a segunda tentativa reusava a chave da primeira com
  // `payment_method_types` diferente.
  it('trocar o método de pagamento gera chave diferente', () => {
    const banco = idempotencyKeyFor('checkout', fatura, corpo());
    const cartao = idempotencyKeyFor(
      'checkout',
      fatura,
      corpo({ payment_method_types: ['card', 'link'] }),
    );

    expect(cartao).not.toBe(banco);
  });

  // O segundo bug. Ao acrescentar `adaptive_pricing` na sessão, toda fatura
  // que já tinha chave passou a reaparecer com corpo novo.
  it('acrescentar um campo novo ao corpo gera chave diferente', () => {
    const antes = idempotencyKeyFor('checkout', fatura, {
      mode: 'payment',
      payment_method_types: ['card'],
    });
    const depois = idempotencyKeyFor('checkout', fatura, {
      mode: 'payment',
      payment_method_types: ['card'],
      adaptive_pricing: { enabled: false },
    });

    expect(depois).not.toBe(antes);
  });

  it('mudar o valor gera chave diferente', () => {
    const cem = idempotencyKeyFor('checkout', fatura, corpo());
    const seiscentos = idempotencyKeyFor(
      'checkout',
      fatura,
      corpo({ line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 60000 } }] }),
    );

    expect(seiscentos).not.toBe(cem);
  });

  it('faturas diferentes com corpo igual não compartilham chave', () => {
    const a = idempotencyKeyFor('checkout', fatura, corpo());
    const b = idempotencyKeyFor('checkout', '11111111-1111-1111-1111-111111111111', corpo());

    expect(a).not.toBe(b);
  });

  it('escopos diferentes não colidem', () => {
    expect(idempotencyKeyFor('checkout', fatura, corpo())).not.toBe(
      idempotencyKeyFor('refund', fatura, corpo()),
    );
  });

  // A chave aparece no log da Stripe e procurar por fatura ali é comum.
  it('escopo e fatura ficam legíveis no começo da chave', () => {
    expect(idempotencyKeyFor('checkout', fatura, corpo())).toMatch(
      new RegExp(`^checkout:${fatura}:[0-9a-f]{24}$`),
    );
  });

  // A Stripe limita a chave a 255 caracteres.
  it('a chave cabe no limite da Stripe mesmo com corpo grande', () => {
    const grande = corpo({ lixo: 'x'.repeat(10000) });
    expect(idempotencyKeyFor('checkout', fatura, grande).length).toBeLessThan(255);
  });
});
