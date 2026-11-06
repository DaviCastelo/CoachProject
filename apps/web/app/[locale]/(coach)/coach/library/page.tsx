import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { loadLibrary } from './actions';
import { LibraryClient } from './library-client';

/**
 * Biblioteca de treinos, jogos e documentos.
 *
 * Só equipe: são fotos e vídeos de menores, e a família não entra aqui. O
 * banco guarda nome, pasta e tamanho; o arquivo fica no bucket `library`.
 */

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = { searchParams: Promise<{ folder?: string }> };

export default async function LibraryPage({ searchParams }: PageProps) {
  await requireRole(['owner', 'admin', 'coach', 'staff']);
  const { folder } = await searchParams;
  const t = await getTranslations('library');

  if (folder && !UUID.test(folder)) notFound();

  const view = await loadLibrary(folder ?? null);
  if (!view) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <LibraryClient key={view.folderId ?? 'root'} view={view} />
    </div>
  );
}
