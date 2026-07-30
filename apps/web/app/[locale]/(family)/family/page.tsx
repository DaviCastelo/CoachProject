import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';

export default async function FamilyHomePage() {
  const t = await getTranslations('family');

  return (
    <div className="p-4">
      <h1 className="text-3xl font-display uppercase tracking-wide mb-6">{t('homeTitle')}</h1>
      <EmptyState
        titleKey="emptyTitle"
        descriptionKey="emptyDescription"
        namespace="family"
      />
    </div>
  );
}
