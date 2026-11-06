import { sweepLibrary } from '@/lib/library/purge';

/**
 * Limpeza diária da biblioteca. O caminho normal apaga na hora; aqui só entra
 * o que falhou e os envios abandonados, que seguravam espaço da cota.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json(await sweepLibrary());
}
