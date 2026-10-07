/**
 * Conciliação de extrato com faturas.
 *
 * O Venmo não tem API de cobrança, mas deixa baixar o extrato em CSV. Como a
 * nossa tela de pagamento pede que a família escreva o número da fatura na
 * observação, o número viaja junto com o dinheiro e volta no extrato. É isso
 * que permite casar automaticamente o que seria conferência manual.
 *
 * Tudo aqui é puro: recebe texto, devolve estrutura. Nada toca banco nem rede,
 * então o caminho de erro é testável sem subir nada.
 */

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Parser de CSV com aspas. Pequeno de propósito: trazer dependência para ler
 * um arquivo de extrato não se paga, e o formato aqui é simples.
 *
 * Trata: campo entre aspas com vírgula dentro, aspas escapadas como "", e
 * quebra de linha CRLF ou LF.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Centavos a partir de um texto de valor. Trabalha em string de propósito:
 * `parseFloat('0.29') * 100` dá 28.999999999999996, e arredondar isso num
 * módulo de cobrança é como se perde um centavo por linha.
 *
 * Aceita "+ $600.00", "-$5", "1,234.56", "600", "(12.34)" (negativo contábil).
 */
export function parseAmountToCents(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;

  const negative = text.startsWith('-') || /^\(.*\)$/.test(text);
  const digits = text.replace(/[^0-9.]/g, '');
  if (digits === '' || !/[0-9]/.test(digits)) return null;

  const [whole = '0', fraction = ''] = digits.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isFinite(cents)) return null;

  return negative ? -cents : cents;
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export type StatementRow = {
  /** Linha no arquivo (1-based), para a tela apontar onde está o problema. */
  line: number;
  date: string | null;
  note: string;
  from: string;
  /** Positivo = dinheiro entrando. Saída é descartada antes de chegar aqui. */
  amountCents: number;
  externalId: string | null;
};

const HEADER_HINTS = ['note', 'amount'];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Acha a coluna cujo cabeçalho contém algum dos termos, na ordem dada. */
function findColumn(header: string[], terms: readonly string[]): number {
  for (const term of terms) {
    const index = header.findIndex((h) => normalize(h).includes(term));
    if (index >= 0) return index;
  }
  return -1;
}

export type StatementParseResult = {
  rows: StatementRow[];
  /** Linhas de saída de dinheiro e transferências, ignoradas de propósito. */
  skipped: number;
  error: string | null;
};

/**
 * Lê um extrato em CSV.
 *
 * O arquivo do Venmo não começa no cabeçalho: tem linhas de conta e saldo
 * antes, e aviso legal depois. Por isso procuramos a linha de cabeçalho em
 * vez de assumir que é a primeira, e as colunas são achadas pelo nome e não
 * pela posição — assim uma mudança de ordem no arquivo não quebra a leitura.
 */
export function parseStatement(text: string): StatementParseResult {
  const table = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''));

  const headerIndex = table.findIndex((row) => {
    const cells = row.map(normalize);
    return HEADER_HINTS.every((hint) => cells.some((cell) => cell.includes(hint)));
  });

  if (headerIndex === -1) {
    return { rows: [], skipped: 0, error: 'no_header' };
  }

  const header = table[headerIndex];
  const col = {
    date: findColumn(header, ['datetime', 'date']),
    note: findColumn(header, ['note', 'description']),
    from: findColumn(header, ['from', 'sender', 'name']),
    amount: findColumn(header, ['amount (total)', 'amount', 'total']),
    status: findColumn(header, ['status']),
    id: findColumn(header, ['id']),
  };

  if (col.amount === -1 || col.note === -1) {
    return { rows: [], skipped: 0, error: 'missing_columns' };
  }

  const rows: StatementRow[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = table[i];
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? '').trim() : '');

    const amount = parseAmountToCents(cell(col.amount));

    // Saída de dinheiro, transferência para o banco e linha sem valor não são
    // recebimento de família. Entram na contagem de ignoradas para a tela
    // poder dizer "23 linhas lidas, 11 ignoradas" em vez de sumir com elas.
    if (amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const status = normalize(cell(col.status));
    if (status !== '' && !status.includes('complete')) {
      skipped++;
      continue;
    }

    rows.push({
      line: i + 1,
      date: cell(col.date) || null,
      note: cell(col.note),
      from: cell(col.from),
      amountCents: amount,
      externalId: cell(col.id) || null,
    });
  }

  return { rows, skipped, error: null };
}

// ---------------------------------------------------------------------------
// Casamento
// ---------------------------------------------------------------------------

/** Formato do nosso número de fatura: ano com 4 dígitos, hífen, 4 dígitos. */
const INVOICE_NUMBER = /\b(\d{4}-\d{4})\b/;

export function extractInvoiceNumber(note: string): string | null {
  return INVOICE_NUMBER.exec(note)?.[1] ?? null;
}

export type OpenInvoice = {
  id: string;
  number: string;
  athleteName: string | null;
  /** Quanto ainda falta pagar. */
  dueCents: number;
};

export type MatchStatus =
  /** Número achado, fatura em aberto e valor exato: pode dar baixa. */
  | 'matched'
  /** Número achado, mas o valor não bate com o saldo. */
  | 'amount_mismatch'
  /** Número achado, mas a fatura não está mais em aberto. */
  | 'not_open'
  /** A observação não trazia número de fatura, ou o número não existe. */
  | 'unmatched'
  /** Duas linhas do extrato apontam para a mesma fatura. */
  | 'duplicate';

export type StatementMatch = {
  row: StatementRow;
  status: MatchStatus;
  invoice: OpenInvoice | null;
};

/**
 * Casa linhas do extrato com faturas em aberto.
 *
 * Só casa por NÚMERO DE FATURA. Casar por nome seria tentador — o extrato
 * traz o nome de quem pagou — mas "J. Silva" pode ser três famílias, e um
 * falso positivo aqui dá baixa numa fatura que ninguém pagou. Linha sem
 * número vira `unmatched` e vai para a mão de alguém, que é o certo.
 */
export function matchStatement(
  rows: readonly StatementRow[],
  invoices: readonly OpenInvoice[],
): StatementMatch[] {
  const byNumber = new Map(invoices.map((invoice) => [invoice.number, invoice]));
  const usados = new Set<string>();

  return rows.map((row) => {
    const number = extractInvoiceNumber(row.note);
    if (!number) return { row, status: 'unmatched' as const, invoice: null };

    const invoice = byNumber.get(number);
    if (!invoice) {
      // O número existe na observação mas não está entre as faturas em
      // aberto: ou já foi paga, ou é de outra organização, ou foi digitada
      // errada. Em qualquer dos casos, decisão humana.
      return { row, status: 'not_open' as const, invoice: null };
    }

    if (usados.has(invoice.id)) {
      return { row, status: 'duplicate' as const, invoice };
    }
    usados.add(invoice.id);

    if (row.amountCents !== invoice.dueCents) {
      return { row, status: 'amount_mismatch' as const, invoice };
    }

    return { row, status: 'matched' as const, invoice };
  });
}

export type MatchSummary = Record<MatchStatus, number> & { total: number; totalCents: number };

/** Resumo para o cabeçalho da tela de importação. */
export function summarizeMatches(matches: readonly StatementMatch[]): MatchSummary {
  const summary: MatchSummary = {
    matched: 0,
    amount_mismatch: 0,
    not_open: 0,
    unmatched: 0,
    duplicate: 0,
    total: matches.length,
    totalCents: 0,
  };

  for (const match of matches) {
    summary[match.status] += 1;
    if (match.status === 'matched') summary.totalCents += match.row.amountCents;
  }

  return summary;
}
