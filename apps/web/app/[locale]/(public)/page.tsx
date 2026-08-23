import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { StaticImage } from '@/components/static-image';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/page-hero';
import { SectionHeader } from '@/components/section-header';
import { SkewImageFrame } from '@/components/skew-image-frame';
import { AthleticCard } from '@/components/athletic-card';
import { SpeedLines } from '@/components/speed-lines';

export const dynamic = 'force-dynamic';

type ProgramRow = {
  slug: string;
  name: string;
  description: string | null;
  starts_on: string | null;
};

function dateRange(start: string | null): string | null {
  if (!start) return null;
  return new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function LandingPage() {
  const t = await getTranslations('landing');

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
      <PageHero
        imageSrc="/images/hero-action-1.png"
        imageAlt="Athletes training at CA Tempo"
        title={t('heroTitle')}
        subtitle={t('heroSubtitle')}
        priority
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">{t('ctaLogin')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-ink-300 bg-transparent text-ink-50 hover:bg-ink-800">
            <Link href="/programs">{t('ctaPrograms')}</Link>
          </Button>
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-16 animate-fade-up">
        <SectionHeader eyebrow={t('meetTeamEyebrow')} title={t('meetTeam')} />
        <div className="mx-auto max-w-4xl">
          <SkewImageFrame
            src="/images/team-poster.png"
            alt="CA Tempo coaching team"
            width={1200}
            height={800}
            className="mx-auto shadow-2xl shadow-accent-500/10"
            imageClassName="max-h-[70vh]"
            sizes="(max-width: 768px) 100vw, 900px"
          />
        </div>
      </section>

      <section className="bg-ink-900 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeader eyebrow={t('foundersEyebrow')} title={t('foundersTitle')} />
          <div className="grid items-center gap-8 md:grid-cols-2">
            <SkewImageFrame
              src="/images/founders.png"
              alt="CA Tempo founders"
              width={600}
              height={800}
              className="mx-auto max-w-sm"
              sizes="(max-width: 768px) 80vw, 400px"
            />
            <div className="text-center md:text-left">
              <div className="mb-4 flex justify-center md:justify-start">
                <SpeedLines count={4} />
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">{t('foundersDescription')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeader title={t('featuredPrograms')} showSpeedLines={false} />
        {programs.length === 0 ? (
          <p className="text-center text-muted-foreground">{t('viewAllPrograms')}</p>
        ) : (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {programs.map((p, i) => (
              <Link key={p.slug} href={`/programs/${p.slug}`} className="block">
                <AthleticCard className="overflow-hidden">
                  <div className="relative h-40">
                    <StaticImage
                      src={`/images/gallery-${(i % 4) + 1}.png`}
                      alt=""
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
                    {dateRange(p.starts_on) ? (
                      <span className="absolute bottom-3 left-3 rounded bg-accent-500 px-2 py-0.5 text-xs font-medium text-ink-950">
                        {dateRange(p.starts_on)}
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
