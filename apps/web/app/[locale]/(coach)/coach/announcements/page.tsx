import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { listAnnouncements } from './actions';
import { listGroups } from '../groups/actions';
import { AnnouncementsClient } from './announcements-client';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('announcements');

  const [announcements, groups] = await Promise.all([listAnnouncements(), listGroups()]);
  const canSend = ctx.role === 'owner' || ctx.role === 'admin' || ctx.role === 'coach';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <AnnouncementsClient announcements={announcements} groups={groups} canSend={canSend} />
    </div>
  );
}
