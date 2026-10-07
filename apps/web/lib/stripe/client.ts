import Stripe from 'stripe';

/**
 * Instância da Stripe — **apenas server-side**. A chave secreta nunca pode
 * chegar ao navegador; se este módulo for importado de um Client Component o
 * build quebra, e é exatamente o que queremos que aconteça.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  cached = new Stripe(key, {
    // Sem apiVersion explícita: usa a versão fixada na conta. Fixar aqui uma
    // versão diferente da que o SDK tipa só gera divergência silenciosa.
    typescript: true,
    appInfo: { name: 'CA Tempo Training', url: 'https://ca-tempo.vercel.app' },
    // A Stripe reenvia o evento se não receber 200 rápido, e o webhook já é
    // idempotente. Ainda assim, repetir uma chamada de LEITURA é barato e
    // repetir uma de ESCRITA não é — por isso idempotency key nas escritas.
    maxNetworkRetries: 2,
  });

  return cached;
}

/** O ambiente está em modo de teste? Serve para avisar na UI antes do go-live. */
export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');
}
