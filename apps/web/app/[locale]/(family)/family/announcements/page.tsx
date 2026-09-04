import { getTranslations } from 'next-intl/server';
import { listFamilyAnnouncements } from '../actions';
import { FamilyAnnouncementsClient } from './announcements-client';

export const dynamic = 'force-dynamic';

export default async function FamilyAnnouncementsPage() {
  const t = await getTranslations('family');
  const announcements = await listFamilyAnnouncements();

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">
          {t('announcements')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('announcementsSubtitle')}</p>
      </div>

      <FamilyAnnouncementsClient announcements={announcements} />
    </div>
  );
}
