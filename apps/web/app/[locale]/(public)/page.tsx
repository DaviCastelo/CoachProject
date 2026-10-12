import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { StaticImage } from '@/components/static-image';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { LandingHero } from '@/components/landing-hero';
import { LandingScenes } from '@/components/landing-scenes';
import { SectionHeader } from '@/components/section-header';
import { SkewImageFrame } from '@/components/skew-image-frame';
import { AthleticCard } from '@/components/athletic-card';
import { SpeedLines } from '@/components/speed-lines';
import { formatDate } from '@/lib/format-datetime';
import { programImageForSlug } from '@/lib/program-image';

export const dynamic = 'force-dynamic';

type ProgramRow = {
  slug: string;
  name: string;
  description: string | null;
  starts_on: string | null;
};

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const locale = await getLocale();

  const svc = createServiceClient();
  const { data } = await svc
    .from('programs')
    .select('slug, name, description, starts_on')
    .eq('status', 'published')
    .order('starts_on', { ascending: true })
    .limit(3);

  const programs = (data ?? []) as ProgramRow[];

  return (
    <>
      <LandingHero
        lead={t('heroLead')}
        trail={t('heroTrail')}
        subtitle={t('heroSubtitle')}
        ticker={[t('tickerPrivate'), t('tickerGroups'), t('tickerCamps')]}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">{t('ctaLogin')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ink-300 bg-transparent text-ink-50 hover:bg-ink-800">
            <Link href="/programs">{t('ctaPrograms')}</Link>
          </Button>
        </div>
      </LandingHero>

      <LandingScenes />

      <section data-landing-scene className="mx-auto max-w-6xl px-4 py-16">
        <div className="scene-head">
          <SectionHeader className="mb-4" eyebrow={t('meetTeamEyebrow')} title={t('meetTeam')} />
          <span className="scene-rule" aria-hidden="true" />
        </div>
        <div className="scene-cut mx-auto max-w-4xl">
          <SkewImageFrame
            src="/images/team-poster.png"
            alt="CA Tempo coaching team"
            width={1200}
            height={800}
            className="scene-poster mx-auto shadow-2xl shadow-accent-500/10"
            imageClassName="max-h-[70vh]"
            sizes="(max-width: 768px) 100vw, 900px"
          />
        </div>
      </section>

      <section data-landing-scene className="bg-ink-900 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="scene-head">
            <SectionHeader className="mb-4" eyebrow={t('foundersEyebrow')} title={t('foundersTitle')} />
            <span className="scene-rule" aria-hidden="true" />
          </div>
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="scene-photo">
              <SkewImageFrame
                src="/images/founders.png"
                alt="CA Tempo founders"
                width={600}
                height={800}
                className="mx-auto max-w-sm"
                sizes="(max-width: 768px) 80vw, 400px"
              />
            </div>
            <div className="scene-copy text-center md:text-left">
              <div className="mb-4 flex justify-center md:justify-start">
                <SpeedLines className="scene-streak" count={4} />
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">{t('foundersDescription')}</p>
            </div>
          </div>
        </div>
      </section>

      <section data-landing-scene className="mx-auto max-w-6xl px-4 py-16">
        <div className="scene-head">
          <SectionHeader className="mb-4" title={t('featuredPrograms')} showSpeedLines={false} />
          <span className="scene-rule" aria-hidden="true" />
        </div>
        {programs.length === 0 ? (
          <p className="text-center text-muted-foreground">{t('viewAllPrograms')}</p>
        ) : (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {programs.map((p) => (
              <Link key={p.slug} href={`/programs/${p.slug}`} className="scene-card block">
                <AthleticCard lift className="overflow-hidden">
                  <div className="relative h-40">
                    <StaticImage
                      src={programImageForSlug(p.slug)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
                    {p.starts_on ? (
                      <span className="absolute bottom-3 left-3 rounded bg-accent-500 px-2 py-0.5 text-xs font-medium text-ink-950">
                        {formatDate(p.starts_on, locale)}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-xl uppercase tracking-wide">{p.name}</h3>
                    {p.description ? (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    ) : null}
                  </div>
                </AthleticCard>
              </Link>
            ))}
          </div>
        )}
        <div className="text-center">
          <Button asChild variant="outline">
            <Link href="/programs">{t('viewAllPrograms')}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
