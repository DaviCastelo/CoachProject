import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { listPrograms, listLinkableForms } from './actions';
import { ProgramsClient } from './programs-client';

/**
 * Programas e preços.
 *
 * É aqui que o valor de uma inscrição passa a existir. Sem esta tela, o preço
 * só entrava por SQL, e a cobrança automática ficava sem matéria-prima.
 */

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('coachPrograms');

  const [programs, forms] = await Promise.all([listPrograms(), listLinkableForms()]);
  const canManage = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProgramsClient programs={programs} forms={forms} canManage={canManage} />
    </div>
  );
}
