import { describe, expect, it } from 'vitest';
import {
  resolveFamilyRegistrationState,
  type BalanceSnapshot,
  type InvoiceSnapshot,
  type RegistrationSnapshot,
} from './registration-state';

function registration(
  status: RegistrationSnapshot['status'],
  optionPriceCents: number | null = null,
): RegistrationSnapshot {
  return { status, optionPriceCents };
}

function invoice(
  status: InvoiceSnapshot['status'],
  totalCents = 60000,
  dueOn: string | null = '2026-11-01',
): InvoiceSnapshot {
  return { status, totalCents, dueOn };
}

function balance(
  paidCents: number,
  pendingCents: number,
  totalCents = 60000,
): BalanceSnapshot {
  return {
    paidCents,
    pendingCents,
    balanceCents: totalCents - paidCents,
  };
}

describe('resolveFamilyRegistrationState', () => {
  it('sem fatura, mostra o estado da inscrição e o preço da opção quando existe', () => {
    expect(resolveFamilyRegistrationState(registration('pending', 35000), null, null)).toMatchObject({
      state: 'pending',
      canPay: false,
      amountCents: 35000,
      dueOn: null,
    });
    expect(resolveFamilyRegistrationState(registration('waitlisted'), null, null).state).toBe('waitlisted');
    expect(resolveFamilyRegistrationState(registration('rejected'), null, null).state).toBe('rejected');
    expect(resolveFamilyRegistrationState(registration('canceled'), null, null).state).toBe('canceled');
  });

  it('aprovada ou concluída sem fatura não oferece pagamento', () => {
    for (const status of ['approved', 'completed'] as const) {
      expect(resolveFamilyRegistrationState(registration(status), null, null)).toMatchObject({
        state: 'unbilled',
        canPay: false,
        amountCents: null,
      });
    }
  });

  it('rascunho de fatura conta como se a cobrança ainda não existisse', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved', 60000),
      invoice('draft'),
      null,
    );
    expect(result).toMatchObject({ state: 'unbilled', canPay: false, amountCents: 60000 });
  });

  it('fatura quitada mostra o total e esconde o botão', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('paid'),
      balance(60000, 0),
    );
    expect(result).toMatchObject({
      state: 'paid',
      canPay: false,
      amountCents: 60000,
      dueOn: null,
    });
  });

  it('saldo zero numa fatura aberta também é pago', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('open'),
      balance(60000, 0),
    );
    expect(result.state).toBe('paid');
    expect(result.canPay).toBe(false);
  });

  it('pagamento bancário a caminho não deixa pagar de novo', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('open'),
      balance(0, 60000),
    );
    expect(result).toMatchObject({
      state: 'processing',
      canPay: false,
      amountCents: 60000,
    });
  });

  it('fatura em aberto com saldo oferece o que falta e a data de vencimento', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('open'),
      balance(10000, 0),
    );
    expect(result).toMatchObject({
      state: 'open',
      canPay: true,
      amountCents: 50000,
      totalCents: 60000,
      paidCents: 10000,
      dueOn: '2026-11-01',
    });
  });

  it('sem linha de saldo, o total da fatura aberta ainda pode ser pago', () => {
    const result = resolveFamilyRegistrationState(registration('approved'), invoice('open'), null);
    expect(result).toMatchObject({ state: 'open', canPay: true, amountCents: 60000 });
  });

  it('fatura cancelada ou incobrável não vira pago mesmo com saldo zero', () => {
    expect(
      resolveFamilyRegistrationState(registration('approved'), invoice('void'), balance(60000, 0)),
    ).toMatchObject({ state: 'void', canPay: false });
    expect(
      resolveFamilyRegistrationState(
        registration('approved'),
        invoice('uncollectible'),
        balance(60000, 0),
      ),
    ).toMatchObject({ state: 'void', canPay: false });
  });

  it('estorno não vira pago só porque o saldo voltou a zero', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('refunded'),
      balance(60000, 0),
    );
    expect(result).toMatchObject({ state: 'refunded', canPay: false, amountCents: 60000 });
  });

  it('fatura quitada vence um pagamento pendente residual', () => {
    const result = resolveFamilyRegistrationState(
      registration('approved'),
      invoice('paid'),
      balance(60000, 1000),
    );
    expect(result.state).toBe('paid');
    expect(result.canPay).toBe(false);
  });
});
