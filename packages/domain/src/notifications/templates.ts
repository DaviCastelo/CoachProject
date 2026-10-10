/**
 * Templates das mensagens transacionais de cobrança.
 *
 * Ficam no domínio, e não em SQL nem no provedor de e-mail, por três razões:
 * dá para testar sem rede, o idioma da família é respeitado com os mesmos
 * três locales do resto do sistema, e trocar de provedor não reescreve texto.
 *
 * O corpo é TEXTO PURO de propósito. Ele é o que fica guardado em
 * `notifications.body`, então precisa ser legível por uma pessoa olhando a
 * fila no painel. O HTML do e-mail é montado em cima disso na hora do envio.
 */

export const NOTIFICATION_TYPES = [
  'invoice_created',
  'payment_received',
  'invoice_reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type TemplateLocale = 'en' | 'pt-BR' | 'es';

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function resolveTemplateLocale(raw: string | null | undefined): TemplateLocale {
  if (raw === 'pt-BR' || raw === 'pt' || raw === 'pt-br') return 'pt-BR';
  if (raw === 'es') return 'es';
  return 'en';
}

export type InvoiceContext = {
  orgName: string;
  /** Primeiro nome de quem recebe. Vazio cai numa saudação sem nome. */
  recipientName?: string | null;
  athleteName: string;
  invoiceNumber: string;
  /** Já formatado na moeda e no locale: formatação é da borda, não do template. */
  amount: string;
  dueDate?: string | null;
  payUrl: string;
  memo?: string | null;
};

export type PaymentContext = {
  orgName: string;
  recipientName?: string | null;
  athleteName: string;
  invoiceNumber: string;
  amount: string;
  method: string;
  /** Saldo restante, quando o pagamento foi parcial. */
  remaining?: string | null;
};

export type RenderedMessage = { subject: string; body: string };

function greeting(locale: TemplateLocale, name?: string | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  if (locale === 'pt-BR') return first ? `Olá, ${first}!` : 'Olá!';
  if (locale === 'es') return first ? `¡Hola, ${first}!` : '¡Hola!';
  return first ? `Hi ${first},` : 'Hi,';
}

/** Junta blocos ignorando os vazios, para linha condicional não virar buraco. */
function paragraphs(...blocks: (string | null | undefined)[]): string {
  return blocks
    .map((block) => block?.trim())
    .filter((block): block is string => Boolean(block))
    .join('\n\n');
}

export function renderInvoiceCreated(
  locale: TemplateLocale,
  ctx: InvoiceContext,
): RenderedMessage {
  const what = ctx.memo ? `${ctx.memo} — ${ctx.athleteName}` : ctx.athleteName;

  if (locale === 'pt-BR') {
    return {
      subject: `${ctx.orgName}: fatura ${ctx.invoiceNumber} de ${ctx.amount}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        `A fatura ${ctx.invoiceNumber} de ${what} está pronta, no valor de ${ctx.amount}.`,
        ctx.dueDate ? `Vencimento: ${ctx.dueDate}.` : null,
        `Para pagar, acesse:\n${ctx.payUrl}`,
        'Pagando pela conta bancária você ajuda o clube a economizar na taxa, e é a opção que aparece primeiro na tela.',
        `Qualquer dúvida, responda este e-mail.\n${ctx.orgName}`,
      ),
    };
  }

  if (locale === 'es') {
    return {
      subject: `${ctx.orgName}: factura ${ctx.invoiceNumber} de ${ctx.amount}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        `La factura ${ctx.invoiceNumber} de ${what} ya está lista, por ${ctx.amount}.`,
        ctx.dueDate ? `Vence el ${ctx.dueDate}.` : null,
        `Para pagar, entra aquí:\n${ctx.payUrl}`,
        'Si pagas con cuenta bancaria ayudas al club a ahorrar en comisiones, y es la opción que aparece primero.',
        `Cualquier duda, responde a este correo.\n${ctx.orgName}`,
      ),
    };
  }

  return {
    subject: `${ctx.orgName}: invoice ${ctx.invoiceNumber} for ${ctx.amount}`,
    body: paragraphs(
      greeting(locale, ctx.recipientName),
      `Invoice ${ctx.invoiceNumber} for ${what} is ready, for ${ctx.amount}.`,
      ctx.dueDate ? `Due ${ctx.dueDate}.` : null,
      `You can pay here:\n${ctx.payUrl}`,
      'Paying from a bank account keeps more of it with the club, and it is the first option on the page.',
      `Any questions, just reply to this email.\n${ctx.orgName}`,
    ),
  };
}

export function renderPaymentReceived(
  locale: TemplateLocale,
  ctx: PaymentContext,
): RenderedMessage {
  if (locale === 'pt-BR') {
    return {
      subject: `${ctx.orgName}: recebemos ${ctx.amount}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        `Recebemos ${ctx.amount} referente à fatura ${ctx.invoiceNumber}, de ${ctx.athleteName}.`,
        ctx.remaining
          ? `Ainda restam ${ctx.remaining} nesta fatura.`
          : 'A fatura está quitada. Obrigado!',
        `Este e-mail serve como recibo.\n${ctx.orgName}`,
      ),
    };
  }

  if (locale === 'es') {
    return {
      subject: `${ctx.orgName}: recibimos ${ctx.amount}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        `Recibimos ${ctx.amount} de la factura ${ctx.invoiceNumber}, de ${ctx.athleteName}.`,
        ctx.remaining
          ? `Todavía quedan ${ctx.remaining} en esta factura.`
          : '¡La factura está pagada. Gracias!',
        `Este correo sirve como recibo.\n${ctx.orgName}`,
      ),
    };
  }

  return {
    subject: `${ctx.orgName}: we received ${ctx.amount}`,
    body: paragraphs(
      greeting(locale, ctx.recipientName),
      `We received ${ctx.amount} toward invoice ${ctx.invoiceNumber}, for ${ctx.athleteName}.`,
      ctx.remaining
        ? `There is still ${ctx.remaining} left on this invoice.`
        : 'This invoice is now paid in full. Thank you!',
      `Keep this email as your receipt.\n${ctx.orgName}`,
    ),
  };
}

export function renderInvoiceReminder(
  locale: TemplateLocale,
  ctx: InvoiceContext & { daysOverdue: number },
): RenderedMessage {
  // O tom muda com o atraso, mas nunca fica agressivo: do outro lado existe
  // uma família que provavelmente só esqueceu, e o clube depende dela.
  const atrasado = ctx.daysOverdue > 0;

  if (locale === 'pt-BR') {
    return {
      subject: atrasado
        ? `${ctx.orgName}: fatura ${ctx.invoiceNumber} está vencida`
        : `${ctx.orgName}: lembrete da fatura ${ctx.invoiceNumber}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        atrasado
          ? `A fatura ${ctx.invoiceNumber}, de ${ctx.amount}, venceu há ${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? 'dia' : 'dias'}.`
          : `Passando para lembrar da fatura ${ctx.invoiceNumber}, de ${ctx.amount}.`,
        `Para pagar:\n${ctx.payUrl}`,
        'Se você já pagou, pode ignorar este e-mail: às vezes a confirmação leva alguns dias para aparecer.',
        ctx.orgName,
      ),
    };
  }

  if (locale === 'es') {
    return {
      subject: atrasado
        ? `${ctx.orgName}: la factura ${ctx.invoiceNumber} está vencida`
        : `${ctx.orgName}: recordatorio de la factura ${ctx.invoiceNumber}`,
      body: paragraphs(
        greeting(locale, ctx.recipientName),
        atrasado
          ? `La factura ${ctx.invoiceNumber}, de ${ctx.amount}, venció hace ${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? 'día' : 'días'}.`
          : `Te recordamos la factura ${ctx.invoiceNumber}, de ${ctx.amount}.`,
        `Para pagar:\n${ctx.payUrl}`,
        'Si ya pagaste, ignora este correo: a veces la confirmación tarda unos días en aparecer.',
        ctx.orgName,
      ),
    };
  }

  return {
    subject: atrasado
      ? `${ctx.orgName}: invoice ${ctx.invoiceNumber} is past due`
      : `${ctx.orgName}: reminder about invoice ${ctx.invoiceNumber}`,
    body: paragraphs(
      greeting(locale, ctx.recipientName),
      atrasado
        ? `Invoice ${ctx.invoiceNumber}, for ${ctx.amount}, is ${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? 'day' : 'days'} past due.`
        : `Just a reminder about invoice ${ctx.invoiceNumber}, for ${ctx.amount}.`,
      `You can pay here:\n${ctx.payUrl}`,
      'If you already paid, please ignore this: confirmation sometimes takes a few days to show up.',
      ctx.orgName,
    ),
  };
}

// ---------------------------------------------------------------------------
// Chave de deduplicação
// ---------------------------------------------------------------------------

/**
 * A chave que impede a família de receber a mesma mensagem duas vezes.
 *
 * Emissão e recibo acontecem uma vez por fatura/pagamento. Lembrete pode
 * repetir, mas no máximo um por dia — por isso a data entra na chave.
 */
export function dedupeKey(
  type: NotificationType,
  id: string,
  day?: string,
): string {
  if (type === 'invoice_reminder') {
    const today = day ?? new Date().toISOString().slice(0, 10);
    return `invoice_reminder:${id}:${today}`;
  }
  return `${type}:${id}`;
}
