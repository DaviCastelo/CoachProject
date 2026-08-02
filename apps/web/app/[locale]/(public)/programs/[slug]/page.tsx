import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { AthleticCard } from '@/components/athletic-card';
import { PageHero } from '@/components/page-hero';

export const dynamic = 'force-dynamic';

type PageProps = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;

type OptionRow = { name: string; description: string | null; price_cents: number };

const GALLERY_IMAGES = [
  '/images/gallery-1.png',
  '/images/gallery-2.png',
  '/images/gallery-3.png',
  '/images/gallery-4.png',
];

function price(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    const code = slug.codePointAt(i) ?? 0;
    h = (h + code) % GALLERY_IMAGES.length;
    if (code > 0xffff) i++;
  }
  return h;
}

function RegisterButton({
  soldOut,
  formSlug,
  soldOutLabel,
  registerLabel,
}: Readonly<{
  soldOut: boolean;
  formSlug: string | null | undefined;
  soldOutLabel: string;
  registerLabel: string;
}>) {
  if (soldOut) {
    return (
      <Button size="lg" disabled>
        {soldOutLabel}
      </Button>
    );
  }
  if (formSlug) {
    return (
      <Button asChild size="lg">
        <Link href={`/register/${formSlug}`}>{registerLabel}</Link>
      </Button>
    );
  }
  return null;
}

async function loadProgram(slug: string) {
  const svc = createServiceClient();
  const { data: program } = await svc
    .from('programs')
    .select('id, slug, name, description, starts_on, ends_on, capacity, min_birth_year, max_birth_year, form_id')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return program;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await loadProgram(slug);
  if (!program) return {};
  const description = program.description ?? 'Register with CA Tempo Training.';
  return {
    title: `${program.name} — CA Tempo Training`,
    description,
    openGraph: { title: program.name, description, type: 'website' },
  };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('programs');
  const svc = createServiceClient();

  const program = await loadProgram(slug);
  if (!program) notFound();

  const { data: optionsData } = await svc
    .from('program_options')
    .select('name, description, price_cents')
    .eq('program_id', program.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const options = (optionsData ?? []) as OptionRow[];

  const { count: regCount } = await svc
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', program.id)
    .neq('status', 'canceled');

  const spotsLeft =
    program.capacity != null ? Math.max(0, program.capacity - (regCount ?? 0)) : null;
  const soldOut = spotsLeft === 0;

  const { data: form } = await svc
    .from('forms')
    .select('slug')
    .eq('id', program.form_id)
    .maybeSingle();

  const heroImage = GALLERY_IMAGES[hashSlug(slug)];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: program.name,
    description: program.description ?? undefined,
    startDate: program.starts_on ?? undefined,
    endDate: program.ends_on ?? undefined,
    organizer: { '@type': 'Organization', name: 'CA Tempo Training' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        imageSrc={heroImage}
        imageAlt={program.name}
        title={program.name}
        compact
      />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <Link href="/programs" className="text-sm text-muted-foreground hover:text-accent-500 transition-colors">
          ← {t('backToAll')}
        </Link>

        {program.description ? (
          <p className="mb-4 mt-4 text-muted-foreground">{program.description}</p>
        ) : null}

        {spotsLeft != null ? (
          <p className={`mb-6 text-sm font-medium ${soldOut ? 'text-danger' : 'text-success'}`}>
            {soldOut
              ? t('soldOut')
              : t('spotsLeft', { left: spotsLeft, total: program.capacity })}
          </p>
        ) : null}

        {options.length > 0 ? (
          <div className="mb-6 space-y-3">
            {options.map((opt) => (
              <AthleticCard key={opt.name} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{opt.name}</p>
                  {opt.description ? (
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  ) : null}
                </div>
                <span className="font-display text-lg text-accent-500">{price(opt.price_cents)}</span>
              </AthleticCard>
            ))}
          </div>
        ) : null}

        <RegisterButton
          soldOut={soldOut}
          formSlug={form?.slug}
          soldOutLabel={t('soldOut')}
          registerLabel={t('registerNow')}
        />
      </main>
    </>
  );
}
