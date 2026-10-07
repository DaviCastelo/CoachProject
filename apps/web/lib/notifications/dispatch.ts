import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { getEmailProvider, emailProviderStatus } from './provider';

/**
 * Drena a caixa de saída.
 *
 * Enquanto não houver conta Resend, isto não envia nada e devolve
 * `configured: false`. As mensagens ficam `pending`, e o painel mostra
 * quantas estão esperando. Esse é o estado de hoje, e é honesto.
 */

/**
 * Mensagem pendente velha não é enviada: é descartada.
 *
 * No dia em que a chave da Resend entrar, a fila pode ter semanas de
 * acúmulo. Disparar tudo de uma vez mandaria cobrança de fatura que já foi
 * paga, lembrete de camp que já acabou, e queimaria o domínio novo em
 * reclamação de spam no primeiro dia.
 */
const MAX_AGE_DAYS = 7;

const MAX_ATTEMPTS = 3;

export type DispatchResult = {
  configured: boolean;
  missing: string[];
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
};

export async function dispatchPendingNotifications(limit = 50): Promise<DispatchResult> {
  const db = createServiceClient() as unknown as SupabaseClient;
  const status = emailProviderStatus();

  const { count: pendingCount } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const base: DispatchResult = {
    configured: status.configured,
    missing: status.missing,
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: pendingCount ?? 0,
  };

  const provider = getEmailProvider();
  if (!provider) return base;

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();

  // Primeiro a limpeza do acúmulo antigo, para não inundar ninguém.
  const { data: stale } = await db
    .from('notifications')
    .select('id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(500);

  if (stale && stale.length > 0) {
    await db
      .from('notifications')
      .update({
        status: 'skipped',
        error: `não enviada: mais de ${MAX_AGE_DAYS} dias na fila`,
      })
      .in(
        'id',
        stale.map((row) => row.id as string),
      );
    base.skipped = stale.length;
  }

  const { data: queue } = await db
    .from('notifications')
    .select('id, recipient, recipient_name, subject, body, payload, attempts')
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);

  for (const row of queue ?? []) {
    const payload = (row.payload ?? {}) as { action_url?: string; locale?: string };

    const result = await provider.send({
      to: row.recipient as string,
      toName: row.recipient_name as string | null,
      subject: row.subject as string,
      text: row.body as string,
      actionUrl: payload.action_url ?? null,
      actionLabel: payload.action_url ? payLabel(payload.locale) : null,
    });

    if (result.ok) {
      await db
        .from('notifications')
        .update({
          status: 'sent',
          provider: provider.name,
          provider_id: result.providerId,
          sent_at: new Date().toISOString(),
          error: null,
          attempts: (row.attempts as number) + 1,
        })
        .eq('id', row.id as string);
      base.sent += 1;
      continue;
    }

    const attempts = (row.attempts as number) + 1;

    // Erro que não se conserta repetindo (endereço inválido, domínio não
    // verificado) vai direto para `failed`. Insistir três vezes num
    // endereço errado só enche o log.
    const giveUp = !result.retryable || attempts >= MAX_ATTEMPTS;

    await db
      .from('notifications')
      .update({
        status: giveUp ? 'failed' : 'pending',
        provider: provider.name,
        error: result.error,
        attempts,
      })
      .eq('id', row.id as string);

    base.failed += 1;
  }

  const { count: after } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  base.pending = after ?? 0;
  return base;
}

function payLabel(locale: string | undefined): string {
  if (locale === 'pt-BR') return 'Pagar agora';
  if (locale === 'es') return 'Pagar ahora';
  return 'Pay now';
}

/**
 * Dispara o envio DEPOIS da resposta já ter ido para o navegador.
 *
 * O cron é rede de segurança para retentativa, mas depender só dele faria a
 * família esperar até a próxima hora pelo link de pagamento, logo depois de
 * se inscrever. Com `after()` o e-mail sai em segundos sem que ninguém fique
 * olhando um botão girando.
 *
 * Chamado UMA vez por ação, nunca dentro de laço: cada chamada registra um
 * callback, e um lote de 70 recibos registraria 70 drenagens da mesma fila.
 */
export function flushNotificationsAfterResponse(limit = 20): void {
  after(async () => {
    try {
      await dispatchPendingNotifications(limit);
    } catch (error) {
      console.error('[notifications] falha ao drenar a fila', error);
    }
  });
}
