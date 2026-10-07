import { describe, it, expect } from 'vitest';
import { daysOverdue, agingBucket, summarizeAging, type AgingInput } from './aging';

const NOW = new Date('2026-10-15T12:00:00');

describe('daysOverdue', () => {
  it('conta a partir do vencimento', () => {
    expect(daysOverdue({ dueOn: '2026-10-10', createdAt: '2026-09-01' }, NOW)).toBe(5);
  });

  it('é negativo quando ainda não venceu', () => {
    expect(daysOverdue({ dueOn: '2026-10-20', createdAt: '2026-09-01' }, NOW)).toBeLessThan(0);
  });

  it('sem vencimento, conta da emissão', () => {
    // Fatura sem prazo não é fatura sem cobrança: deixá-la fora do
    // relatório é fazer ela sumir.
    expect(daysOverdue({ dueOn: null, createdAt: '2026-10-05' }, NOW)).toBe(10);
  });

  it('não desloca o dia por causa de fuso', () => {
    // `new Date('2026-10-15')` é meia-noite UTC e, formatada em fuso
    // negativo, cai no dia 14. Aqui a data precisa ser lida como local.
    expect(daysOverdue({ dueOn: '2026-10-15', createdAt: '2026-10-01' }, NOW)).toBe(0);
  });

  it('data inválida não vira atraso', () => {
    expect(daysOverdue({ dueOn: 'nao-e-data', createdAt: 'tambem-nao' }, NOW)).toBe(0);
  });
});

describe('agingBucket', () => {
  it.each([
    ['2026-10-20', 'current'],
    ['2026-10-15', 'current'],
    ['2026-10-14', 'd1_7'],
    ['2026-10-08', 'd1_7'],
    ['2026-10-07', 'd8_30'],
    ['2026-09-15', 'd8_30'],
    ['2026-09-14', 'd31_plus'],
    ['2026-06-01', 'd31_plus'],
  ])('vencimento %s cai em %s', (dueOn, bucket) => {
    expect(agingBucket({ dueOn, createdAt: '2026-01-01' }, NOW)).toBe(bucket);
  });
});

describe('summarizeAging', () => {
  const invoices: AgingInput[] = [
    { dueOn: '2026-10-20', createdAt: '2026-10-01', dueCents: 60000 }, // em dia
    { dueOn: '2026-10-12', createdAt: '2026-09-20', dueCents: 35000 }, // 3 dias
    { dueOn: '2026-10-01', createdAt: '2026-09-01', dueCents: 60000 }, // 14 dias
    { dueOn: '2026-08-01', createdAt: '2026-07-01', dueCents: 8000 }, // 75 dias
  ];

  it('distribui nas faixas', () => {
    const report = summarizeAging(invoices, NOW);
    expect(report.buckets.current.count).toBe(1);
    expect(report.buckets.d1_7.count).toBe(1);
    expect(report.buckets.d8_30.count).toBe(1);
    expect(report.buckets.d31_plus.count).toBe(1);
  });

  it('soma o valor de cada faixa', () => {
    const report = summarizeAging(invoices, NOW);
    expect(report.buckets.current.cents).toBe(60000);
    expect(report.buckets.d31_plus.cents).toBe(8000);
  });

  it('separa o que já venceu do total', () => {
    // $1.630 em aberto, mas só $1.030 realmente atrasados. A diferença é o
    // que muda a conversa com o cliente.
    const report = summarizeAging(invoices, NOW);
    expect(report.totalCents).toBe(163000);
    expect(report.overdueCents).toBe(103000);
    expect(report.overdueCount).toBe(3);
  });

  it('lista vazia não quebra', () => {
    const report = summarizeAging([], NOW);
    expect(report.totalCount).toBe(0);
    expect(report.overdueCents).toBe(0);
    expect(report.buckets.current.count).toBe(0);
  });
});
