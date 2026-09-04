import { getTranslations } from 'next-intl/server';
import { StaticImage } from '@/components/static-image';
import { listFamilyEvents } from './actions';
import { FamilyClient } from './family-client';

export const dynamic = 'force-dynamic';

export default async function FamilyHomePage() {
  const t = await getTranslations('family');

  const { athletes, events } = await listFamilyEvents();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <section className="relative aspect-[20/9] overflow-hidden rounded-xl border border-ink-700">
        <StaticImage
          src="/images/hero-action-2.png"
          alt="Athlete training"
          fill
          className="object-cover object-center"
          sizes="(min-width: 768px) 768px, 100vw"
          priority
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            {t('homeTitle')}
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-accent-500" aria-hidden="true" />
      </section>

      <FamilyClient athletes={athletes} events={events} />
    </div>
  );
}
