import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { StaticImage } from '@/components/static-image';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { LandingHero } from '@/components/landing-hero';
import { SectionHeader } from '@/components/section-header';
import { AthleticCard } from '@/components/athletic-card';
import { CoachGrid } from '@/components/coach-grid';
import { FoundersBlock } from '@/components/founders-block';
import { StatsBand, type Stat } from '@/components/stats-band';
import { HowItWorks, type Step } from '@/components/how-it-works';
import { FinalCta } from '@/components/final-cta';
import { ScrollProgress } from '@/components/scroll-progress';
import { formatDate } from '@/lib/format-datetime';
import { programImage } from '@/lib/program-image';
import { COACHES } from '@/lib/team';

export const dynamic = 'force-dynamic';

type ProgramRow = {
  slug: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  hero_image_url: string | null;
};

/*
 * Os números da faixa saem do banco da própria organização.
 *
 * Não inventei "500 atletas desde 2019": afirmação de marketing é o cliente
 * que assina. O que o banco sabe, o banco responde, e `StatsBand` esconde
 * sozinha o que vier zerado.
 */
async function loadStats() {
  const svc = createServiceClient();
  const [athletes, groups, sessions] = await Promise.all([
    svc.from('athletes').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    svc.from('groups').select('id', { count: 'exact', head: true }),
    svc
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .is('canceled_at', null)
      .lt('starts_at', new Date().toISOString()),
  ]);

  return {
    athletes: athletes.count ?? 0,
    groups: groups.count ?? 0,
    sessions: sessions.count ?? 0,
  };
}

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const locale = await getLocale();

  const svc = createServiceClient();
  const [{ data }, counts] = await Promise.all([
    svc
      .from('programs')
      .select('slug, name, description, starts_on, hero_image_url')
      .eq('status', 'published')
      .order('starts_on', { ascending: true })
      .limit(3),
    loadStats(),
  ]);

  const programs = (data ?? []) as ProgramRow[];

  const stats: Stat[] = [
    { id: 'athletes', value: counts.athletes, label: t('statAthletes') },
    { id: 'groups', value: counts.groups, label: t('statGroups') },
    { id: 'sessions', value: counts.sessions, label: t('statSessions') },
    { id: 'coaches', value: COACHES.length, label: t('statCoaches') },
  ];

  const steps: Step[] = [
    { title: t('step1Title'), text: t('step1Text') },
    { title: t('step2Title'), text: t('step2Text') },
    { title: t('step3Title'), text: t('step3Text') },
  ];

  return (
    <>
      <ScrollProgress />

      <LandingHero
        lead={t('heroLead')}
        trail={t('heroTrail')}
        subtitle={t('heroSubtitle')}
        ticker={[t('tickerPrivate'), t('tickerGroups'), t('tickerCamps')]}
      >
        {/* Ver Programas na frente de propósito: quem cai aqui pelo Instagram
            ainda não tem conta, e "Entrar" é uma porta fechada para ele. */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="fx-sweep hover:-translate-y-0.5">
            <Link href="/programs">{t('ctaPrograms')}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-ink-300 bg-transparent text-ink-50 hover:-translate-y-0.5 hover:bg-ink-800"
          >
            <Link href="/login">{t('ctaLogin')}</Link>
          </Button>
        </div>
      </LandingHero>

      <StatsBand stats={stats} locale={locale} />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <SectionHeader className="mb-4" eyebrow={t('howEyebrow')} title={t('howTitle')} />
          <span className="fx-rule" aria-hidden="true" />
        </div>
        <HowItWorks steps={steps} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <SectionHeader className="mb-4" eyebrow={t('meetTeamEyebrow')} title={t('meetTeam')} />
          <span className="fx-rule" aria-hidden="true" />
        </div>
        <CoachGrid roleLabel={t('roleCoach')} />
      </section>

      <section className="on-dark fx-cut-top bg-ink-900 pb-16 pt-24 md:pt-28">
        <div className="mx-auto max-w-6xl px-4">
          <div>
            <SectionHeader
              className="mb-4"
              eyebrow={t('foundersEyebrow')}
              title={t('foundersTitle')}
            />
            <span className="fx-rule" aria-hidden="true" />
          </div>
          <FoundersBlock roleLabel={t('roleFounder')} />
          <p className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
            {t('foundersDescription')}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <SectionHeader className="mb-4" title={t('featuredPrograms')} showSpeedLines={false} />
          <span className="fx-rule" aria-hidden="true" />
        </div>
        {programs.length === 0 ? (
          <p className="text-center text-muted-foreground">{t('noPrograms')}</p>
        ) : (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {programs.map((p, i) => (
              <Link
                key={p.slug}
                href={`/programs/${p.slug}`}
                className="fx-ring fx-stagger-item block"
                style={{ '--i': i } as React.CSSProperties}
              >
                <AthleticCard lift className="overflow-hidden">
                  <div className="relative h-40">
                    <StaticImage
                      src={programImage(p)}
                      alt=""
                      fill
                      className="object-cover object-[center_18%]"
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
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
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

      <FinalCta title={t('finalCtaTitle')} subtitle={t('finalCtaSubtitle')}>
        <Button asChild size="lg" className="fx-sweep hover:-translate-y-0.5">
          <Link href="/programs">{t('ctaPrograms')}</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-ink-300 bg-transparent text-ink-50 hover:-translate-y-0.5 hover:bg-ink-800"
        >
          <Link href="/login">{t('ctaLogin')}</Link>
        </Button>
      </FinalCta>
    </>
  );
}
