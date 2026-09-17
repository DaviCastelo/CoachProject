import { getTranslations } from 'next-intl/server';
import { listFamilyEvents } from './actions';
import { FamilyClient } from './family-client';
import { PageContainer } from '@/components/page-container';
import { StaticImage } from '@/components/static-image';

export const dynamic = 'force-dynamic';

export default async function FamilyHomePage() {
  const t = await getTranslations('family');
  const { athletes, events } = await listFamilyEvents();
  const hasUpcoming = events.some((e) => new Date(e.endsAt) >= new Date());

  return (
    <PageContainer className="space-y-6">
      {hasUpcoming ? (
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">{t('homeTitle')}</h1>
        </header>
      ) : (
        <section className="relative aspect-[3/1] overflow-hidden rounded-xl border border-border">
          <StaticImage
            src="/images/hero-action-2.png"
            alt=""
            fill
            className="object-cover object-center"
            sizes="(min-width: 768px) 768px, 100vw"
            priority
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h1 className="font-display text-3xl uppercase tracking-wide">{t('homeTitle')}</h1>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-accent-500" aria-hidden="true" />
        </section>
      )}

      <FamilyClient athletes={athletes} events={events} />
    </PageContainer>
  );
}
