/**
 * Formatação de dinheiro no locale ativo.
 *
 * Tudo no sistema trafega em CENTAVOS inteiros, nunca em float. `0.1 + 0.2`
 * não dá `0.3` em ponto flutuante, e num módulo de cobrança esse centavo
 * perdido vira divergência de fechamento que ninguém consegue explicar.
 * A conversão para decimal acontece só aqui, na borda da apresentação.
 */

export function formatMoney(cents: number, locale: string, currency = 'usd'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Valor sem símbolo de moeda, para campos de formulário e links. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
