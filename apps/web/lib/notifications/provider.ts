/**
 * Provedor de e-mail.
 *
 * A Resend é chamada por `fetch` direto, sem o pacote npm. Trazer uma
 * dependência que vai ficar sem uso até o cliente abrir a conta não se paga,
 * e a API deles é um POST só. No dia em que `RESEND_API_KEY` aparecer no
 * ambiente, isto passa a enviar sem nenhuma mudança de código.
 *
 * Enquanto não houver chave, `getEmailProvider()` devolve null e as
 * notificações ficam `pending` na caixa de saída. Marcar como enviada o que
 * não saiu seria pior do que não enviar: o painel mentiria.
 */

export type SendResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string; retryable: boolean };

export type OutgoingEmail = {
  to: string;
  toName?: string | null;
  subject: string;
  /** Corpo em texto puro, como está guardado em `notifications.body`. */
  text: string;
  /** URL de ação, quando houver: vira botão no HTML. */
  actionUrl?: string | null;
  actionLabel?: string | null;
};

export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SendResult>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML mínimo a partir do texto puro.
 *
 * Sem framework de e-mail de propósito: cliente de e-mail quebra CSS
 * moderno, e um e-mail de cobrança que não renderiza é pior que um feio.
 * Tabela, cores inline e nada mais.
 */
export function renderEmailHtml(email: OutgoingEmail): string {
  const blocks = email.text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    // A URL já aparece no texto puro; no HTML ela vira o botão, então a
    // linha solta com o link cru é removida para não duplicar.
    .filter((block) => !(email.actionUrl && block.includes(email.actionUrl) && block.length < email.actionUrl.length + 40))
    .map((block) => `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const button =
    email.actionUrl && email.actionLabel
      ? `<p style="margin:0 0 24px">
           <a href="${escapeHtml(email.actionUrl)}"
              style="display:inline-block;background:#c8a24a;color:#0a0a0a;text-decoration:none;
                     padding:12px 22px;border-radius:8px;font-weight:600">
             ${escapeHtml(email.actionLabel)}
           </a>
         </p>`
      : '';

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;
                   font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                   font-size:15px;color:#141414">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;
             border-radius:12px;padding:28px">
        <tr><td>${blocks}${button}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    let response: Response;

    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: renderEmailHtml(email),
        }),
      });
    } catch (error) {
      // Rede caiu: vale tentar de novo depois.
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { id?: string } | null;
      return { ok: true, providerId: data?.id ?? null };
    }

    const detail = await response.text().catch(() => '');

    // 4xx é problema nosso (endereço inválido, domínio não verificado) e
    // reenviar não conserta. 429 e 5xx são do outro lado e valem retry.
    const retryable = response.status === 429 || response.status >= 500;

    return {
      ok: false,
      error: `resend ${response.status}: ${detail.slice(0, 300)}`,
      retryable,
    };
  }
}

/**
 * Devolve o provedor configurado, ou `null` quando ainda não há conta.
 *
 * `null` não é erro: é o estado esperado hoje. Quem chama precisa tratar,
 * e o tratamento certo é deixar a mensagem na fila.
 */
export function getEmailProvider(): EmailProvider | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM_EMAIL;

  if (!apiKey || !from) return null;

  return new ResendProvider(apiKey, from);
}

export function emailProviderStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.NOTIFICATIONS_FROM_EMAIL) missing.push('NOTIFICATIONS_FROM_EMAIL');
  return { configured: missing.length === 0, missing };
}
