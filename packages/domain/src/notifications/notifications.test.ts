import { describe, it, expect } from 'vitest';
import {
  renderInvoiceCreated,
  renderPaymentReceived,
  renderInvoiceReminder,
  resolveTemplateLocale,
  isNotificationType,
  dedupeKey,
  type InvoiceContext,
  type PaymentContext,
} from './templates';

const invoice: InvoiceContext = {
  orgName: 'CA Tempo Training',
  recipientName: 'Maria Silva',
  athleteName: 'Joao Silva',
  invoiceNumber: '2026-0041',
  amount: '$600.00',
  dueDate: 'Oct 15, 2026',
  payUrl: 'https://ca-tempo.vercel.app/pay/abc-123',
  memo: 'Full Camp Pass',
};

const payment: PaymentContext = {
  orgName: 'CA Tempo Training',
  recipientName: 'Maria Silva',
  athleteName: 'Joao Silva',
  invoiceNumber: '2026-0041',
  amount: '$600.00',
  method: 'Venmo',
};

describe('locale do template', () => {
  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['es', 'es'],
    ['en', 'en'],
    ['fr', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ])('%s resolve para %s', (raw, expected) => {
    expect(resolveTemplateLocale(raw as string | null)).toBe(expected);
  });
});

describe('fatura emitida', () => {
  it.each(['en', 'pt-BR', 'es'] as const)('em %s traz valor, número e link', (locale) => {
    const { subject, body } = renderInvoiceCreated(locale, invoice);
    expect(subject).toContain('2026-0041');
    expect(subject).toContain('$600.00');
    expect(body).toContain('https://ca-tempo.vercel.app/pay/abc-123');
    expect(body).toContain('Joao Silva');
  });

  it('usa só o primeiro nome na saudação', () => {
    // "Olá, Maria Silva!" soa como carta de cobrança de banco.
    const { body } = renderInvoiceCreated('pt-BR', invoice);
    expect(body).toContain('Olá, Maria!');
    expect(body).not.toContain('Olá, Maria Silva!');
  });

  it('sem nome, a saudação não fica com buraco', () => {
    const { body } = renderInvoiceCreated('pt-BR', { ...invoice, recipientName: null });
    expect(body.startsWith('Olá!')).toBe(true);
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('null');
  });

  it('sem vencimento, não sobra linha vazia', () => {
    const { body } = renderInvoiceCreated('en', { ...invoice, dueDate: null });
    expect(body).not.toContain('Due ');
    expect(body).not.toMatch(/\n\n\n/);
  });

  it('empurra o pagamento bancário, que é o barato', () => {
    expect(renderInvoiceCreated('pt-BR', invoice).body).toContain('conta bancária');
    expect(renderInvoiceCreated('en', invoice).body).toContain('bank account');
  });
});

describe('pagamento recebido', () => {
  it('quitação total agradece e não fala de saldo', () => {
    const { body } = renderPaymentReceived('pt-BR', payment);
    expect(body).toContain('quitada');
    expect(body).not.toContain('restam');
  });

  it('pagamento parcial informa o que falta', () => {
    const { body } = renderPaymentReceived('pt-BR', { ...payment, remaining: '$250.00' });
    expect(body).toContain('$250.00');
    expect(body).not.toContain('quitada');
  });

  it('serve como recibo nos três idiomas', () => {
    expect(renderPaymentReceived('pt-BR', payment).body).toContain('recibo');
    expect(renderPaymentReceived('es', payment).body).toContain('recibo');
    expect(renderPaymentReceived('en', payment).body).toContain('receipt');
  });
});

describe('lembrete de fatura', () => {
  it('antes do vencimento é só um lembrete', () => {
    const { subject, body } = renderInvoiceReminder('pt-BR', { ...invoice, daysOverdue: 0 });
    expect(subject).toContain('lembrete');
    expect(subject).not.toContain('vencida');
    expect(body).toContain('lembrar');
  });

  it('depois do vencimento diz há quantos dias', () => {
    const { subject, body } = renderInvoiceReminder('pt-BR', { ...invoice, daysOverdue: 5 });
    expect(subject).toContain('vencida');
    expect(body).toContain('5 dias');
  });

  it('um dia de atraso é singular', () => {
    expect(renderInvoiceReminder('pt-BR', { ...invoice, daysOverdue: 1 }).body).toContain('1 dia');
    expect(renderInvoiceReminder('pt-BR', { ...invoice, daysOverdue: 1 }).body).not.toContain('1 dias');
    expect(renderInvoiceReminder('en', { ...invoice, daysOverdue: 1 }).body).toContain('1 day');
  });

  it('sempre dá saída para quem já pagou', () => {
    // O pagamento por ACH leva dias para compensar. Cobrar alguém que já
    // pagou, sem essa ressalva, gera ligação e desconfiança.
    for (const locale of ['en', 'pt-BR', 'es'] as const) {
      const { body } = renderInvoiceReminder(locale, { ...invoice, daysOverdue: 3 });
      expect(body.toLowerCase()).toMatch(/already paid|já pagou|ya pagaste/);
    }
  });
});

describe('chave de deduplicação', () => {
  it('emissão e recibo são uma vez por id', () => {
    expect(dedupeKey('invoice_created', 'inv-1')).toBe('invoice_created:inv-1');
    expect(dedupeKey('payment_received', 'pay-1')).toBe('payment_received:pay-1');
  });

  it('lembrete inclui o dia, para poder repetir amanhã mas não hoje', () => {
    expect(dedupeKey('invoice_reminder', 'inv-1', '2026-10-15')).toBe(
      'invoice_reminder:inv-1:2026-10-15',
    );
    expect(dedupeKey('invoice_reminder', 'inv-1', '2026-10-15')).not.toBe(
      dedupeKey('invoice_reminder', 'inv-1', '2026-10-16'),
    );
  });

  it('valida o tipo', () => {
    expect(isNotificationType('invoice_created')).toBe(true);
    expect(isNotificationType('qualquer_coisa')).toBe(false);
  });
});
