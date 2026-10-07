/**
 * Taxas por método de pagamento (01-Planejamento/07-pagamentos-e-taxas.md §1).
 *
 * Isto não é detalhe de UI: é o argumento econômico inteiro do módulo. O teto
 * de $5 do ACH é o que muda o jogo, porque os tickets da CA Tempo são altos
 * ($350 a $600). Num Full Camp de $600 a taxa de ACH é $4,80 contra $17,70 no
 * cartão — e acima de $625 o ACH fica travado em $5 enquanto o cartão continua
 * subindo sem limite.
 *
 * Valores verificados em stripe.com/us/pricing. Se a Stripe mudar o preço,
 * muda aqui e os testes dizem o que mais se moveu.
 */

import type { PaymentMethod } from './gateway';

export type FeeRule = {
  /** Fração sobre o valor. 0.029 = 2,9%. */
  percent: number;
  /** Parte fixa, em centavos. */
  fixedCents: number;
  /** Teto da taxa, em centavos. `null` = sem teto. */
  capCents: number | null;
};

/**
 * `null` marca método cuja taxa nós não temos como saber sozinhos.
 * Venmo é o caso típico: em Business Profile ele cobra, mas a cobrança
 * acontece fora do nosso sistema e ninguém digita o valor na baixa manual.
 * Melhor devolver "não sei" do que inventar um número que vai parar num
 * relatório financeiro.
 */
export const FEE_SCHEDULE: Record<PaymentMethod, FeeRule | null> = {
  card: { percent: 0.029, fixedCents: 30, capCents: null },
  us_bank_account: { percent: 0.008, fixedCents: 0, capCents: 500 },
  cash_app: { percent: 0.029, fixedCents: 30, capCents: null },
  link: { percent: 0.029, fixedCents: 30, capCents: null },
  apple_pay: { percent: 0.029, fixedCents: 30, capCents: null },
  google_pay: { percent: 0.029, fixedCents: 30, capCents: null },
  venmo: null,
  cash: { percent: 0, fixedCents: 0, capCents: null },
  check: { percent: 0, fixedCents: 0, capCents: null },
  zelle: { percent: 0, fixedCents: 0, capCents: null },
  account_credit: { percent: 0, fixedCents: 0, capCents: null },
  other: null,
};

/**
 * Taxa estimada para um pagamento. `null` quando o método não permite estimar.
 *
 * É estimativa: a taxa real vem da Stripe no webhook e é gravada em
 * `payments.fee_cents`. Esta função serve para mostrar o custo ANTES de pagar,
 * que é o que empurra a família para o ACH.
 */
export function estimateFeeCents(
  method: PaymentMethod,
  amountCents: number,
): number | null {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const rule = FEE_SCHEDULE[method];
  if (rule === null) return null;

  const raw = amountCents * rule.percent + rule.fixedCents;
  // A Stripe arredonda ao centavo mais próximo.
  const rounded = Math.round(raw);

  return rule.capCents === null ? rounded : Math.min(rounded, rule.capCents);
}

export type FeeComparison = {
  amountCents: number;
  achFeeCents: number;
  cardFeeCents: number;
  /** Quanto a organização deixa de perder escolhendo ACH. */
  savingsCents: number;
  /** O ACH bateu no teto de $5? Acima disso a diferença só cresce. */
  achAtCap: boolean;
};

/**
 * Comparação ACH x cartão para um valor. Alimenta tanto o texto do checkout
 * ("você economiza $12,90 pagando pelo banco") quanto o relatório de taxa por
 * método do painel.
 */
export function compareAchToCard(amountCents: number): FeeComparison | null {
  const ach = estimateFeeCents('us_bank_account', amountCents);
  const card = estimateFeeCents('card', amountCents);
  if (ach === null || card === null) return null;

  const cap = FEE_SCHEDULE.us_bank_account?.capCents ?? null;

  return {
    amountCents,
    achFeeCents: ach,
    cardFeeCents: card,
    savingsCents: card - ach,
    achAtCap: cap !== null && ach >= cap,
  };
}

/**
 * Desconto por pagar via ACH, em centavos.
 *
 * O documento 07 §4 recomenda DESCONTO no ACH em vez de taxa extra no cartão:
 * o resultado financeiro é o mesmo, mas surcharge é proibido em Connecticut e
 * Massachusetts, nunca pode incidir sobre cartão de débito, e exige
 * notificação prévia às bandeiras. Desconto é permitido em todo lugar.
 *
 * Repassamos no máximo a economia real — nunca mais do que isso, senão deixa
 * de ser desconto e vira preço diferente, o que muda a conversa com o fisco.
 */
export function achDiscountCents(
  amountCents: number,
  /** Fração da economia repassada à família. 1 = repassa tudo. */
  passThrough = 1,
): number {
  const comparison = compareAchToCard(amountCents);
  if (comparison === null) return 0;

  const clamped = Math.min(Math.max(passThrough, 0), 1);
  return Math.max(0, Math.round(comparison.savingsCents * clamped));
}
