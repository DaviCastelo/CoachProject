import type {
  PaymentGateway,
  CheckoutParams,
  CheckoutSession,
  GatewayPayment,
  RefundResult,
  WebhookEvent,
} from '@ca-tempo/domain';

/**
 * Adaptador para o dinheiro que NÃO passa pelo sistema: Venmo, dinheiro,
 * cheque, Zelle e crédito em conta.
 *
 * O Venmo é o motivo deste arquivo existir. Ele não expõe API de cobrança para
 * terceiros (a única integração oficial é via PayPal/Braintree, a 3,49% +
 * $0,49, que é mais caro que tudo). Como o cliente já usa Venmo no dia a dia,
 * a escolha foi registrar em vez de integrar.
 *
 * Então aqui não existe cobrança: existe INSTRUÇÃO de pagamento e, depois,
 * baixa manual. Os métodos que dependem de falar com um provedor lançam erro
 * em vez de devolver resposta falsa — a alternativa seria o sistema fingir
 * saber de um dinheiro que ninguém confirmou.
 */

export class OfflineGateway implements PaymentGateway {
  readonly provider = 'offline' as const;

  constructor(private readonly siteUrl: string) {}

  /**
   * Não cria cobrança: devolve o endereço da nossa própria página de
   * instruções, onde a família vê o valor, o @ do Venmo da organização e o QR
   * code. Assim o fluxo de checkout fica igual para qualquer gateway — muda o
   * destino, não o formato.
   */
  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    const url = new URL(`/pay/${params.invoiceId}/instructions`, this.siteUrl);

    return {
      id: `offline:${params.invoiceId}`,
      url: url.toString(),
      // Instrução de pagamento não expira: o vencimento é da fatura, não do link.
      expiresAt: null,
    };
  }

  /**
   * Não há provedor a consultar. O estado do pagamento offline é o que está
   * na nossa tabela `payments`, gravado por quem deu a baixa — nós somos a
   * fonte da verdade, não um espelho de sistema externo.
   */
  // Os três métodos abaixo ignoram os argumentos da interface de propósito, e
  // por isso nem os declaram: TypeScript aceita implementação com menos
  // parâmetros, e nome de variável não usada só viraria ruído no lint.
  async getPayment(): Promise<GatewayPayment | null> {
    return null;
  }

  async refund(): Promise<RefundResult> {
    throw new Error(
      'Pagamento offline não é estornado pelo sistema. Devolva o dinheiro pelo ' +
        'Venmo (ou pelo meio em que recebeu) e registre o estorno na tela da fatura.',
    );
  }

  verifyWebhook(): WebhookEvent {
    throw new Error('Pagamento offline não emite webhook: a baixa é manual.');
  }
}

/** Fábrica, para o chamador não precisar saber de onde sai a URL base. */
export function createOfflineGateway(): OfflineGateway {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error('Missing NEXT_PUBLIC_SITE_URL');
  }
  return new OfflineGateway(siteUrl);
}
