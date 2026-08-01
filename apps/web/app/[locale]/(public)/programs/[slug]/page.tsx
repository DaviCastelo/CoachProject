import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

type OptionRow = { name: string; description: string | null; price_cents: number };

function price(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
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
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icons/shield.svg" alt="CA Tempo" width={32} height={32} />
          <span className="font-display text-lg uppercase tracking-wide">CA Tempo</span>
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <Link href="/programs" className="text-sm text-muted-foreground hover:underline">
          ← All programs
        </Link>
        <h1 className="mb-1 mt-2 font-display text-3xl uppercase tracking-wide">{program.name}</h1>
        {program.description ? (
          <p className="mb-4 text-muted-foreground">{program.description}</p>
        ) : null}

        {spotsLeft != null ? (
          <p className={`mb-6 text-sm font-medium ${soldOut ? 'text-danger' : 'text-success'}`}>
            {soldOut ? 'Sold out' : `${spotsLeft} of ${program.capacity} spots left`}
          </p>
        ) : null}

        {options.length > 0 ? (
          <div className="mb-6 space-y-3">
            {options.map((opt) => (
              <Card key={opt.name} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{opt.name}</p>
                  {opt.description ? (
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  ) : null}
                </div>
                <span className="font-display text-lg">{price(opt.price_cents)}</span>
              </Card>
            ))}
          </div>
        ) : null}

        {form?.slug && !soldOut ? (
          <Button asChild size="lg">
            <Link href={`/register/${form.slug}`}>Register now</Link>
          </Button>
        ) : soldOut ? (
          <Button size="lg" disabled>
            Sold out
          </Button>
        ) : null}
      </main>
    </div>
  );
}
