import { describe, it, expect } from 'vitest';
import {
  estimateFeeCents,
  compareAchToCard,
  achDiscountCents,
  isOfflineMethod,
  deriveInvoiceStatus,
  balanceCents,
  overpaymentCents,
  isOverdue,
  parseReservationPolicy,
  reservedUntil,
  holdsSpot,
  DEFAULT_RESERVATION_POLICY,
} from './index';

describe('taxas — números do documento 07', () => {
  // Os valores esperados saem da tabela de 01-Planejamento/07-pagamentos-e-taxas.md §2.
  // Se um deles quebrar, ou a Stripe mudou o preço ou o documento está desatualizado.
  it.each([
    ['Full Camp Pass', 60000, 1770, 480],
    ['Week Pass', 35000, 1045, 280],
    ['Sessão 1:1', 8000, 262, 64],
  ])('%s de %i centavos: cartão %i, ACH %i', (_nome, valor, cartao, ach) => {
    expect(estimateFeeCents('card', valor)).toBe(cartao);
    expect(estimateFeeCents('us_bank_account', valor)).toBe(ach);
  });

  it('economia por pagamento bate com a tabela do documento', () => {
    expect(compareAchToCard(60000)?.savingsCents).toBe(1290); // $12,90
    expect(compareAchToCard(35000)?.savingsCents).toBe(765); // $7,65
    expect(compareAchToCard(8000)?.savingsCents).toBe(198); // $1,98
  });
});

describe('taxas — o teto de $5 do ACH', () => {
  it('abaixo do teto cobra os 0,8% cheios', () => {
    expect(estimateFeeCents('us_bank_account', 50000)).toBe(400);
  });

  it('em $625 a taxa encosta exatamente no teto', () => {
    expect(estimateFeeCents('us_bank_account', 62500)).toBe(500);
  });

  it('acima de $625 fica travada em $5 por mais que o valor cresça', () => {
    expect(estimateFeeCents('us_bank_account', 70000)).toBe(500);
    expect(estimateFeeCents('us_bank_account', 500000)).toBe(500);
  });

  it('o cartão, ao contrário, não para de subir', () => {
    expect(estimateFeeCents('card', 500000)).toBe(14530); // $145,30
  });

  it('a partir do teto, quanto maior o ticket maior a vantagem do ACH', () => {
    const camp = compareAchToCard(60000)!;
    const temporada = compareAchToCard(300000)!;

    expect(camp.achAtCap).toBe(false);
    expect(temporada.achAtCap).toBe(true);
    expect(temporada.savingsCents).toBeGreaterThan(camp.savingsCents);
  });
});

describe('taxas — métodos sem taxa conhecida', () => {
  it('Venmo devolve null em vez de inventar número', () => {
    // Em Business Profile o Venmo cobra, mas a cobrança acontece fora do
    // sistema e ninguém digita o valor na baixa manual. "Não sei" é a
    // resposta honesta — número inventado contamina relatório financeiro.
    expect(estimateFeeCents('venmo', 60000)).toBeNull();
    expect(compareAchToCard(60000)).not.toBeNull();
  });

  it('dinheiro e cheque custam zero, e isso é diferente de desconhecido', () => {
    expect(estimateFeeCents('cash', 60000)).toBe(0);
    expect(estimateFeeCents('check', 60000)).toBe(0);
  });

  it('valor inválido não vira taxa', () => {
    expect(estimateFeeCents('card', 0)).toBeNull();
    expect(estimateFeeCents('card', -100)).toBeNull();
    expect(estimateFeeCents('card', Number.NaN)).toBeNull();
  });

  it('classifica corretamente o que é offline', () => {
    expect(isOfflineMethod('venmo')).toBe(true);
    expect(isOfflineMethod('cash')).toBe(true);
    expect(isOfflineMethod('us_bank_account')).toBe(false);
    expect(isOfflineMethod('card')).toBe(false);
  });
});

describe('desconto por ACH', () => {
  it('repassa no máximo a economia real', () => {
    expect(achDiscountCents(60000)).toBe(1290);
  });

  it('aceita repassar só parte', () => {
    expect(achDiscountCents(60000, 0.5)).toBe(645);
  });

  it('não repassa mais do que existe, mesmo pedindo', () => {
    // Passar de 100% deixaria de ser desconto e viraria outro preço, o que
    // muda a natureza fiscal da operação.
    expect(achDiscountCents(60000, 5)).toBe(1290);
  });

  it('nunca devolve desconto negativo', () => {
    expect(achDiscountCents(60000, -2)).toBe(0);
    expect(achDiscountCents(0)).toBe(0);
  });
});

describe('status da fatura', () => {
  it('quita quando o pago alcança o total', () => {
    expect(deriveInvoiceStatus({ current: 'open', totalCents: 60000, paidCents: 60000 })).toBe('paid');
  });

  it('pagamento parcial mantém em aberto', () => {
    expect(deriveInvoiceStatus({ current: 'open', totalCents: 60000, paidCents: 35000 })).toBe('open');
  });

  it('decisão humana não é desfeita por cálculo', () => {
    // Anular, estornar e dar baixa como incobrável são escolhas de alguém.
    // Um pagamento chegando depois não pode reabrir isso sozinho.
    expect(deriveInvoiceStatus({ current: 'void', totalCents: 60000, paidCents: 60000 })).toBe('void');
    expect(deriveInvoiceStatus({ current: 'refunded', totalCents: 60000, paidCents: 60000 })).toBe('refunded');
    expect(deriveInvoiceStatus({ current: 'uncollectible', totalCents: 60000, paidCents: 0 })).toBe('uncollectible');
  });

  it('rascunho não vira pago por acidente', () => {
    expect(deriveInvoiceStatus({ current: 'draft', totalCents: 60000, paidCents: 60000 })).toBe('draft');
  });

  it('saldo não fica negativo e o excedente vira crédito', () => {
    expect(balanceCents(60000, 70000)).toBe(0);
    expect(overpaymentCents(60000, 70000)).toBe(10000);
    expect(overpaymentCents(60000, 60000)).toBe(0);
  });
});

describe('atraso', () => {
  const ontem = new Date('2026-09-29T12:00:00Z');
  const agora = new Date('2026-09-30T12:00:00Z');

  it('vencida e não paga está em atraso', () => {
    expect(isOverdue({ status: 'open', dueOn: ontem, totalCents: 60000, paidCents: 0, now: agora })).toBe(true);
  });

  it('vencida mas quitada não está em atraso', () => {
    expect(isOverdue({ status: 'open', dueOn: ontem, totalCents: 60000, paidCents: 60000, now: agora })).toBe(false);
  });

  it('fatura sem vencimento nunca atrasa', () => {
    expect(isOverdue({ status: 'open', dueOn: null, totalCents: 60000, paidCents: 0, now: agora })).toBe(false);
  });

  it('fatura anulada não entra na inadimplência', () => {
    expect(isOverdue({ status: 'void', dueOn: ontem, totalCents: 60000, paidCents: 0, now: agora })).toBe(false);
  });

  it('data inválida não vira atraso', () => {
    expect(isOverdue({ status: 'open', dueOn: 'nao-e-data', totalCents: 60000, paidCents: 0, now: agora })).toBe(false);
  });
});

describe('reserva de vaga', () => {
  const agora = new Date('2026-09-30T12:00:00Z');

  it('o padrão segura por 72 horas', () => {
    expect(DEFAULT_RESERVATION_POLICY).toEqual({ mode: 'timed', hours: 72 });
    expect(reservedUntil({ mode: 'timed', hours: 72 }, agora)?.toISOString()).toBe(
      '2026-10-03T12:00:00.000Z',
    );
  });

  it('em "none" ninguém segura vaga sem pagar', () => {
    expect(reservedUntil({ mode: 'none' }, agora)).toBeNull();
    expect(holdsSpot({ policy: { mode: 'none' }, reservedUntil: null, now: agora })).toBe(false);
  });

  it('em "unlimited" a vaga fica segura mesmo sem data', () => {
    expect(reservedUntil({ mode: 'unlimited' }, agora)).toBeNull();
    expect(holdsSpot({ policy: { mode: 'unlimited' }, reservedUntil: null, now: agora })).toBe(true);
  });

  it('em "timed" a vaga é liberada quando o prazo passa', () => {
    const dentro = new Date('2026-10-01T12:00:00Z');
    const depois = new Date('2026-10-04T12:00:00Z');
    const prazo = reservedUntil({ mode: 'timed', hours: 72 }, agora)!;

    expect(holdsSpot({ policy: { mode: 'timed', hours: 72 }, reservedUntil: prazo, now: dentro })).toBe(true);
    expect(holdsSpot({ policy: { mode: 'timed', hours: 72 }, reservedUntil: prazo, now: depois })).toBe(false);
  });

  it('configuração malformada cai no padrão em vez de explodir', () => {
    expect(parseReservationPolicy(null)).toEqual(DEFAULT_RESERVATION_POLICY);
    expect(parseReservationPolicy({})).toEqual(DEFAULT_RESERVATION_POLICY);
    expect(parseReservationPolicy({ mode: 'inventado' })).toEqual(DEFAULT_RESERVATION_POLICY);
    expect(parseReservationPolicy({ mode: 'timed' })).toEqual(DEFAULT_RESERVATION_POLICY);
    expect(parseReservationPolicy({ mode: 'timed', hours: -5 })).toEqual(DEFAULT_RESERVATION_POLICY);
    expect(parseReservationPolicy('timed')).toEqual(DEFAULT_RESERVATION_POLICY);
  });

  it('lê as três políticas válidas', () => {
    expect(parseReservationPolicy({ mode: 'none' })).toEqual({ mode: 'none' });
    expect(parseReservationPolicy({ mode: 'unlimited' })).toEqual({ mode: 'unlimited' });
    expect(parseReservationPolicy({ mode: 'timed', hours: 24 })).toEqual({ mode: 'timed', hours: 24 });
  });
});
