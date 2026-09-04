import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { listSessions } from './actions';
import { listGroups } from '../groups/actions';
import { ScheduleClient } from './schedule-client';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('schedule');

  const [sessions, groups] = await Promise.all([listSessions(), listGroups()]);
  const canEdit = ctx.role === 'owner' || ctx.role === 'admin' || ctx.role === 'coach';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle', { count: sessions.length })}</p>
      </div>

      <ScheduleClient sessions={sessions} groups={groups} canEdit={canEdit} />
    </div>
  );
}
