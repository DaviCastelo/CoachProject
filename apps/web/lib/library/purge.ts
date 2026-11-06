import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'library';

/** Envio interrompido há mais que isto já não termina: o token de envio venceu. */
const STALE_UPLOAD_HOURS = 24;

type PurgeRow = { id: string; storage_key: string | null; thumb_key: string | null };

/**
 * Tira do bucket e só depois apaga a linha. Na ordem inversa, uma falha no
 * meio deixaria um arquivo ocupando espaço sem nenhum registro apontando para
 * ele, e nada nunca mais o encontraria. Assim a linha `deleting` continua lá
 * para o cron tentar de novo.
 */
async function purgeRows(db: SupabaseClient, rows: PurgeRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const paths = rows.flatMap((r) => [r.storage_key, r.thumb_key]).filter((p): p is string => !!p);

  if (paths.length > 0) {
    const { error } = await db.storage.from(BUCKET).remove(paths);
    if (error) {
      console.error('[library] falha ao remover do bucket', error);
      return 0;
    }
  }

  const { error } = await db
    .from('library_files')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    );
  if (error) {
    console.error('[library] falha ao apagar linhas', error);
    return 0;
  }
  return rows.length;
}

/** Remove o que uma organização marcou para apagar. */
export async function purgeDeletedFiles(orgId: string): Promise<number> {
  const db = createServiceClient() as unknown as SupabaseClient;
  const { data } = await db
    .from('library_files')
    .select('id, storage_key, thumb_key')
    .eq('organization_id', orgId)
    .eq('status', 'deleting')
    .limit(500);
  return purgeRows(db, (data ?? []) as PurgeRow[]);
}

/**
 * Rede de segurança diária: refaz exclusões que falharam e devolve à cota o
 * que ficou reservado por envio abandonado no meio.
 */
export async function sweepLibrary(): Promise<{ purged: number; abandoned: number }> {
  const db = createServiceClient() as unknown as SupabaseClient;
  const cutoff = new Date(Date.now() - STALE_UPLOAD_HOURS * 3_600_000).toISOString();

  const [{ data: deleting }, { data: stale }] = await Promise.all([
    db.from('library_files').select('id, storage_key, thumb_key').eq('status', 'deleting').limit(500),
    db
      .from('library_files')
      .select('id, storage_key, thumb_key')
      .eq('status', 'uploading')
      .lt('created_at', cutoff)
      .limit(500),
  ]);

  return {
    purged: await purgeRows(db, (deleting ?? []) as PurgeRow[]),
    abandoned: await purgeRows(db, (stale ?? []) as PurgeRow[]),
  };
}
