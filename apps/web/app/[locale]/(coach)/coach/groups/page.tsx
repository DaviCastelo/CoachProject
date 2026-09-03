import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { listGroups } from './actions';
import { GroupsClient } from './groups-client';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('groups');
  const groups = await listGroups();

  const canManage = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle', { count: groups.length })}</p>
      </div>

      <GroupsClient groups={groups} canManage={canManage} />
    </div>
  );
}
