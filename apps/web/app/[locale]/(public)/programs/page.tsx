import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { StaticImage } from '@/components/static-image';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHero } from '@/components/page-hero';
import { AthleticCard } from '@/components/athletic-card';
import { formatDateRange } from '@/lib/format-datetime';
import { programImageForSlug } from '@/lib/program-image';

export const dynamic = 'force-dynamic';

type ProgramRow = {
  slug: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

export default async function ProgramsPage() {
  const t = await getTranslations('programs');
  const locale = await getLocale();
  const svc = createServiceClient();
  const { data } = await svc
    .from('programs')
    .select('slug, name, description, starts_on, ends_on')
    .eq('status', 'published')
    .order('starts_on', { ascending: true });

  const programs = (data ?? []) as ProgramRow[];

  return (
    <>
      <PageHero
        imageSrc="/images/gallery-2.png"
        imageAlt="Training session"
        title={t('title')}
        compact
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {programs.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="space-y-4">
            {programs.map((p) => (
              <Link key={p.slug} href={`/programs/${p.slug}`} className="block">
                <AthleticCard lift className="overflow-hidden">
                  <div className="flex gap-0">
                    <div className="relative hidden h-24 w-28 shrink-0 sm:block">
                      <StaticImage
                        src={programImageForSlug(p.slug)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    </div>
                    <div className="flex-1 p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="font-display text-xl uppercase tracking-wide">{p.name}</h2>
                        {formatDateRange(p.starts_on, p.ends_on, locale) ? (
                          <span className="shrink-0 text-sm text-accent-700 dark:text-accent-500">
                            {formatDateRange(p.starts_on, p.ends_on, locale)}
                          </span>
                        ) : null}
                      </div>
                      {p.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                      ) : null}
                    </div>
                  </div>
                </AthleticCard>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
