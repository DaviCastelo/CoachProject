/**
 * O que a família deve entender de uma inscrição.
 *
 * A tela só desenha este resultado. A ordem importa: uma fatura quitada não
 * pode aparecer como "em aberto", e um pagamento bancário ainda compensando
 * não pode oferecer o botão de pagar de novo.
 */

export type RegistrationStatus =
  | 'pending'
  | 'approved'
  | 'waitlisted'
  | 'rejected'
  | 'canceled'
  | 'completed';

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'refunded'
  | 'uncollectible';

export type FamilyPaymentState =
  | 'paid'
  | 'processing'
  | 'open'
  | 'void'
  | 'refunded'
  | 'pending'
  | 'waitlisted'
  | 'rejected'
  | 'canceled'
  | 'unbilled';

export type InvoiceSnapshot = {
  status: InvoiceStatus;
  totalCents: number;
  dueOn: string | null;
};

export type BalanceSnapshot = {
  paidCents: number;
  pendingCents: number;
  balanceCents: number;
};

export type RegistrationSnapshot = {
  status: RegistrationStatus;
  /** Preço da opção, só quando a leitura pública deixou a linha visível. */
  optionPriceCents: number | null;
};

export type FamilyRegistrationState = {
  state: FamilyPaymentState;
  canPay: boolean;
  /** Centavos a mostrar. Null quando não há valor legível. */
  amountCents: number | null;
  totalCents: number | null;
  paidCents: number;
  dueOn: string | null;
};

const WITHOUT_INVOICE: Record<RegistrationStatus, FamilyPaymentState> = {
  pending: 'pending',
  waitlisted: 'waitlisted',
  rejected: 'rejected',
  canceled: 'canceled',
  approved: 'unbilled',
  completed: 'unbilled',
};

function unbilled(registration: RegistrationSnapshot): FamilyRegistrationState {
  return {
    state: WITHOUT_INVOICE[registration.status] ?? 'pending',
    canPay: false,
    amountCents: registration.optionPriceCents,
    totalCents: null,
    paidCents: 0,
    dueOn: null,
  };
}

function charged(
  state: FamilyPaymentState,
  canPay: boolean,
  amountCents: number,
  invoice: InvoiceSnapshot,
  paidCents: number,
): FamilyRegistrationState {
  return {
    state,
    canPay,
    amountCents,
    totalCents: invoice.totalCents,
    paidCents,
    dueOn: canPay ? invoice.dueOn : null,
  };
}

export function resolveFamilyRegistrationState(
  registration: RegistrationSnapshot,
  invoice: InvoiceSnapshot | null,
  balance: BalanceSnapshot | null,
): FamilyRegistrationState {
  // Rascunho ainda não é cobrança: a página pública de pagamento recusa.
  if (!invoice || invoice.status === 'draft') return unbilled(registration);

  const paidCents = balance?.paidCents ?? 0;
  const pendingCents = balance?.pendingCents ?? 0;
  const balanceCents = balance?.balanceCents ?? invoice.totalCents;

  const closed =
    invoice.status === 'void' ||
    invoice.status === 'uncollectible' ||
    invoice.status === 'refunded';

  // Quitada, ou já não há saldo, e a fatura não foi cancelada nem estornada.
  if ((invoice.status === 'paid' || balanceCents <= 0) && !closed) {
    return charged('paid', false, invoice.totalCents, invoice, paidCents);
  }

  // ACH em compensação. O saldo ainda existe, mas pagar de novo duplicaria.
  if (pendingCents > 0 && !closed) {
    return charged('processing', false, balanceCents, invoice, paidCents);
  }

  if (invoice.status === 'open' && balanceCents > 0) {
    return charged('open', true, balanceCents, invoice, paidCents);
  }

  if (invoice.status === 'void' || invoice.status === 'uncollectible') {
    return charged('void', false, invoice.totalCents, invoice, paidCents);
  }

  if (invoice.status === 'refunded') {
    return charged('refunded', false, invoice.totalCents, invoice, paidCents);
  }

  return unbilled(registration);
}
