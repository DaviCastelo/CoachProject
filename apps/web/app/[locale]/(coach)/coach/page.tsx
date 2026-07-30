import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';

export default async function CoachDashboardPage() {
  const t = await getTranslations('coach');

  return (
    <div className="p-4">
      <h1 className="text-3xl font-display uppercase tracking-wide mb-6">{t('dashboardTitle')}</h1>
      <EmptyState
        titleKey="emptyTitle"
        descriptionKey="emptyDescription"
        actionKey="emptyAction"
        namespace="coach"
      />
    </div>
  );
}
