import { StaticImage } from '@/components/static-image';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';
import { AthleticCard } from '@/components/athletic-card';

export default async function FamilyHomePage() {
  const t = await getTranslations('family');

  return (
    <div>
      <div className="relative h-36 overflow-hidden">
        <StaticImage
          src="/images/hero-action-2.png"
          alt="Athlete training"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="hero-overlay-compact absolute inset-0" />
        <div className="absolute inset-0 flex items-end p-4">
          <h1 className="font-display text-3xl uppercase tracking-wide">{t('homeTitle')}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <AthleticCard className="p-4">
          <h2 className="mb-2 font-display text-lg uppercase tracking-wide">{t('upcomingSessions')}</h2>
          <p className="text-sm text-muted-foreground">{t('noSessionsScheduled')}</p>
        </AthleticCard>

        <EmptyState
          titleKey="emptyTitle"
          descriptionKey="emptyDescription"
          namespace="family"
          imageSrc="/images/hero-action-1.png"
        />
      </div>
    </div>
  );
}
