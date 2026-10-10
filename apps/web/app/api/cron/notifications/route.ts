import { dispatchPendingNotifications } from '@/lib/notifications/dispatch';

/**
 * Drena a caixa de saída de notificações.
 *
 * Pensado para o Vercel Cron, que manda `Authorization: Bearer $CRON_SECRET`.
 * Também serve para disparo manual durante o desenvolvimento.
 *
 * Enquanto não houver conta Resend, responde `configured: false` e informa
 * quantas mensagens estão esperando. Não é erro: é o estado de hoje, e é o
 * número que o admin precisa ver.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** O Vercel Cron chama com GET; o POST fica para disparo manual. */
export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  // Sem segredo configurado a rota fica fechada, não aberta. O padrão
  // inseguro aqui seria uma URL que qualquer um dispara para esvaziar a fila
  // de e-mails de um cliente.
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await dispatchPendingNotifications();

  return Response.json(result, {
    status: result.configured || result.pending === 0 ? 200 : 202,
  });
}
