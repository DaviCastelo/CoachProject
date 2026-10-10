import { createHash } from 'node:crypto';

/*
 * Chave de idempotência para as chamadas que CRIAM coisa na Stripe.
 *
 * O contrato da Stripe é estrito: a mesma chave só pode ser reusada com
 * exatamente os mesmos parâmetros. Repetir com parâmetro diferente não
 * devolve a resposta antiga, devolve erro 400, e no nosso caso isso vira
 * tela de erro na cara da família.
 *
 * A versão anterior montava a chave à mão com `invoiceId` e `amountCents`.
 * Parecia suficiente e não era, por dois motivos que custaram caro:
 *
 *  1. Não incluía o método escolhido. Quem clicava em "Conta bancária",
 *     voltava e escolhia "Cartão" mandava a MESMA chave com
 *     `payment_method_types` diferente. Erro, sem ter feito nada de errado.
 *
 *  2. Não incluía o resto do corpo. No dia em que a sessão ganhou
 *     `adaptive_pricing`, toda fatura que já tinha sessão passou a dar erro,
 *     porque a chave antiga reaparecia com corpo novo.
 *
 * Listar campos à mão sempre vai esquecer o próximo campo. Por isso a chave
 * agora deriva do corpo inteiro: muda qualquer coisa no pedido, muda a chave.
 * Pedido idêntico, que é o caso do duplo clique, continua caindo na mesma
 * chave e reaproveitando a sessão, que é o que a gente queria desde o começo.
 */

/**
 * Deriva a chave a partir do corpo real do pedido.
 *
 * O `scope` e o `invoiceId` ficam legíveis no começo porque essa chave
 * aparece no log da Stripe, e procurar por fatura ali é comum. O resto é o
 * resumo do corpo.
 */
export function idempotencyKeyFor(scope: string, invoiceId: string, payload: unknown): string {
  // 24 caracteres de sha256 são de sobra: a chave só precisa ser estável e
  // não colidir dentro das 24h em que a Stripe a guarda.
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);

  return `${scope}:${invoiceId}:${digest}`;
}
