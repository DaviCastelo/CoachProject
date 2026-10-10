/**
 * Interface de gateway de pagamento (01-Planejamento/07-pagamentos-e-taxas.md §5).
 *
 * Nenhum código de domínio importa `stripe` diretamente. Se um dia o PayPal
 * fizer proposta melhor, ou se o cliente decidir rodar só com Venmo e dinheiro,
 * troca-se o adaptador sem tocar em regra de negócio.
 *
 * Implementações:
 *   apps/web/lib/stripe/gateway.ts   → StripeGateway  (cartão, ACH, Cash App)
 *   apps/web/lib/offline/gateway.ts  → OfflineGateway (Venmo, dinheiro, cheque)
 */

export const PAYMENT_PROVIDERS = ['stripe', 'offline'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = [
  'card',
  'us_bank_account',
  'cash_app',
  'link',
  'apple_pay',
  'google_pay',
  'venmo',
  'cash',
  'check',
  'zelle',
  'account_credit',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'canceled',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Métodos que o OfflineGateway registra: o dinheiro não passa pelo sistema. */
export const OFFLINE_METHODS = [
  'venmo',
  'cash',
  'check',
  'zelle',
  'account_credit',
  'other',
] as const satisfies readonly PaymentMethod[];

export function isOfflineMethod(method: PaymentMethod): boolean {
  return (OFFLINE_METHODS as readonly PaymentMethod[]).includes(method);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export type CheckoutParams = {
  invoiceId: string;
  organizationId: string;
  amountCents: number;
  currency: string;
  description: string;
  /** Ordem importa: o primeiro aparece primeiro no checkout. ACH na frente. */
  methods: readonly PaymentMethod[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Vai junto para a Stripe e volta no webhook: é como amarramos o pagamento. */
  metadata?: Record<string, string>;
};

export type CheckoutSession = {
  id: string;
  url: string;
  expiresAt: string | null;
};

export type GatewayPayment = {
  externalId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountCents: number;
  /**
   * Moeda em que o pagamento foi EFETIVAMENTE feito, em minúsculas ('usd').
   *
   * Não é decoração: `amountCents` só significa alguma coisa junto com ela. A
   * Stripe pode cobrar numa moeda diferente da que pedimos, e aí 519 centavos
   * de real entrariam no lugar de 100 centavos de dólar. Quem aplica o
   * pagamento compara esta moeda com a da fatura antes de somar.
   */
  currency: string;
  /** Taxa real cobrada pela processadora. `null` quando ainda não liquidou. */
  feeCents: number | null;
  paidAt: string | null;
  failureReason: string | null;
};

export type RefundResult = {
  externalId: string;
  amountCents: number;
  status: PaymentStatus;
};

export type WebhookEvent = {
  id: string;
  type: string;
  payload: unknown;
};

export interface PaymentGateway {
  readonly provider: PaymentProvider;

  createCheckout(params: CheckoutParams): Promise<CheckoutSession>;

  getPayment(externalId: string): Promise<GatewayPayment | null>;

  refund(externalId: string, amountCents?: number): Promise<RefundResult>;

  /**
   * Verifica a assinatura e devolve o evento. Lança se a assinatura não bate.
   * Nunca confiar no corpo da requisição sem passar por aqui: sem verificação,
   * qualquer um que descubra a URL do webhook consegue marcar fatura como paga.
   */
  verifyWebhook(payload: string, signature: string): WebhookEvent;
}
