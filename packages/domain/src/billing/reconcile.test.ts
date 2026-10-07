import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  parseAmountToCents,
  parseStatement,
  extractInvoiceNumber,
  matchStatement,
  summarizeMatches,
  type OpenInvoice,
} from './reconcile';

describe('parseCsv', () => {
  it('lê linhas e colunas simples', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('respeita vírgula dentro de aspas', () => {
    expect(parseCsv('note,amount\n"Camp, parcela 1",600')).toEqual([
      ['note', 'amount'],
      ['Camp, parcela 1', '600'],
    ]);
  });

  it('entende aspas escapadas', () => {
    expect(parseCsv('a\n"ele disse ""oi"""')).toEqual([['a'], ['ele disse "oi"']]);
  });

  it('aceita CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseAmountToCents', () => {
  it.each([
    ['$600.00', 60000],
    ['+ $600.00', 60000],
    ['600', 60000],
    ['1,234.56', 123456],
    ['- $5.00', -500],
    ['-5', -500],
    ['(12.34)', -1234],
    ['$0.29', 29],
  ])('%s vira %i centavos', (raw, cents) => {
    expect(parseAmountToCents(raw)).toBe(cents);
  });

  it('não perde centavo em valor que o float erraria', () => {
    // parseFloat('0.29') * 100 === 28.999999999999996
    expect(parseAmountToCents('0.29')).toBe(29);
    expect(parseAmountToCents('1.005')).toBe(100);
    expect(parseAmountToCents('19.99')).toBe(1999);
  });

  it('devolve null para o que não é valor', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('   ')).toBeNull();
    expect(parseAmountToCents('n/a')).toBeNull();
  });
});

describe('parseStatement', () => {
  // O arquivo do Venmo não começa no cabeçalho: tem conta e saldo antes e
  // aviso legal depois.
  const venmoCsv = [
    'Account Statement - (@CA-Tempo-Training)',
    'Account Activity',
    '',
    ',ID,Datetime,Type,Status,Note,From,To,Amount (total)',
    ',,,,,,,,',
    ',111,2026-10-01T10:00:00,Payment,Complete,2026-0041 - Joao,Pai Silva,CA Tempo,"+ $600.00"',
    ',112,2026-10-01T11:00:00,Payment,Complete,2026-0042 - Maria,Mae Souza,CA Tempo,"+ $600.00"',
    ',113,2026-10-02T09:00:00,Standard Transfer,Complete,,CA Tempo,Bank,"- $1,200.00"',
    ',114,2026-10-02T10:00:00,Payment,Issued,2026-0043 - Pedro,Pai Lima,CA Tempo,"+ $350.00"',
    '',
    'In case of errors or questions about your electronic transfers...',
  ].join('\n');

  it('acha o cabeçalho no meio do arquivo', () => {
    const result = parseStatement(venmoCsv);
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(2);
  });

  it('lê os campos da linha', () => {
    const [first] = parseStatement(venmoCsv).rows;
    expect(first.note).toBe('2026-0041 - Joao');
    expect(first.from).toBe('Pai Silva');
    expect(first.amountCents).toBe(60000);
    expect(first.externalId).toBe('111');
  });

  it('ignora saída de dinheiro e transferência para o banco', () => {
    // Sem isso, a transferência de -$1.200 que a organização fez para o
    // próprio banco entraria como se fosse pagamento de família.
    const result = parseStatement(venmoCsv);
    expect(result.rows.every((r) => r.amountCents > 0)).toBe(true);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('ignora transação que ainda não completou', () => {
    const notes = parseStatement(venmoCsv).rows.map((r) => r.note);
    expect(notes).not.toContain('2026-0043 - Pedro');
  });

  it('acha as colunas pelo nome, não pela posição', () => {
    const reordenado = [
      'Amount (total),Note,Status',
      '"$350.00",2026-0044 - Ana,Complete',
    ].join('\n');
    const [row] = parseStatement(reordenado).rows;
    expect(row.amountCents).toBe(35000);
    expect(row.note).toBe('2026-0044 - Ana');
  });

  it('avisa quando o arquivo não parece um extrato', () => {
    expect(parseStatement('foo,bar\n1,2').error).toBe('no_header');
    expect(parseStatement('').error).toBe('no_header');
  });
});

describe('extractInvoiceNumber', () => {
  it('acha o número no meio da observação', () => {
    expect(extractInvoiceNumber('2026-0041 - Joao')).toBe('2026-0041');
    expect(extractInvoiceNumber('pagamento camp 2026-0041 obrigado!')).toBe('2026-0041');
  });

  it('devolve null quando não tem número', () => {
    expect(extractInvoiceNumber('camp do Joao')).toBeNull();
    expect(extractInvoiceNumber('')).toBeNull();
    expect(extractInvoiceNumber('2026')).toBeNull();
  });
});

describe('matchStatement', () => {
  const invoices: OpenInvoice[] = [
    { id: 'inv-1', number: '2026-0041', athleteName: 'Joao', dueCents: 60000 },
    { id: 'inv-2', number: '2026-0042', athleteName: 'Maria', dueCents: 60000 },
    { id: 'inv-3', number: '2026-0043', athleteName: 'Pedro', dueCents: 35000 },
  ];

  const row = (note: string, amountCents: number, from = 'Pai') => ({
    line: 1,
    date: null,
    note,
    from,
    amountCents,
    externalId: null,
  });

  it('casa por número com valor exato', () => {
    const [match] = matchStatement([row('2026-0041 - Joao', 60000)], invoices);
    expect(match.status).toBe('matched');
    expect(match.invoice?.id).toBe('inv-1');
  });

  it('marca divergência de valor em vez de dar baixa', () => {
    // Pagou $350 numa fatura de $600: dar baixa aqui quitaria uma dívida
    // que não foi quitada.
    const [match] = matchStatement([row('2026-0041', 35000)], invoices);
    expect(match.status).toBe('amount_mismatch');
    expect(match.invoice?.dueCents).toBe(60000);
  });

  it('não casa por nome, mesmo quando o nome bate', () => {
    // "J. Silva" pode ser três famílias. Falso positivo aqui dá baixa numa
    // fatura que ninguém pagou.
    const [match] = matchStatement([row('pagamento do Joao', 60000, 'Joao Silva')], invoices);
    expect(match.status).toBe('unmatched');
    expect(match.invoice).toBeNull();
  });

  it('sinaliza número que não está entre as faturas em aberto', () => {
    const [match] = matchStatement([row('2026-9999', 60000)], invoices);
    expect(match.status).toBe('not_open');
  });

  it('não deixa duas linhas quitarem a mesma fatura', () => {
    const matches = matchStatement(
      [row('2026-0041', 60000), row('2026-0041', 60000)],
      invoices,
    );
    expect(matches[0].status).toBe('matched');
    expect(matches[1].status).toBe('duplicate');
  });

  it('resume para o cabeçalho da tela', () => {
    const matches = matchStatement(
      [
        row('2026-0041', 60000),
        row('2026-0042', 60000),
        row('2026-0043', 1000),
        row('sem numero', 5000),
      ],
      invoices,
    );
    const summary = summarizeMatches(matches);

    expect(summary.total).toBe(4);
    expect(summary.matched).toBe(2);
    expect(summary.amount_mismatch).toBe(1);
    expect(summary.unmatched).toBe(1);
    // Só o que casou entra no total a lançar.
    expect(summary.totalCents).toBe(120000);
  });
});

describe('extrato de ponta a ponta', () => {
  it('lê o CSV e casa com as faturas', () => {
    const csv = [
      'Account Statement',
      ',ID,Datetime,Type,Status,Note,From,To,Amount (total)',
      ',1,2026-10-01,Payment,Complete,2026-0041 - Joao,Pai Silva,CA Tempo,"+ $600.00"',
      ',2,2026-10-01,Payment,Complete,obrigado!,Tio Zé,CA Tempo,"+ $50.00"',
      ',3,2026-10-02,Standard Transfer,Complete,,CA Tempo,Bank,"- $600.00"',
    ].join('\n');

    const { rows, skipped } = parseStatement(csv);
    const matches = matchStatement(rows, [
      { id: 'inv-1', number: '2026-0041', athleteName: 'Joao', dueCents: 60000 },
    ]);
    const summary = summarizeMatches(matches);

    expect(skipped).toBe(1);
    expect(summary.matched).toBe(1);
    expect(summary.unmatched).toBe(1);
    expect(summary.totalCents).toBe(60000);
  });
});
