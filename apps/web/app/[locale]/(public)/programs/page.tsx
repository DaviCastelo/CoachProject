import Link from 'next/link';
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabase/service';
import { Card } from '@/components/ui/card';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

type ProgramRow = {
  slug: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

function dateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default async function ProgramsPage() {
  const svc = createServiceClient();
  const { data } = await svc
    .from('programs')
    .select('slug, name, description, starts_on, ends_on')
    .eq('status', 'published')
    .order('starts_on', { ascending: true });

  const programs = (data ?? []) as ProgramRow[];

  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-6 font-display text-3xl uppercase tracking-wide">Programs</h1>

        {programs.length === 0 ? (
          <p className="text-muted-foreground">No open programs right now. Check back soon.</p>
        ) : (
          <div className="space-y-4">
            {programs.map((p) => (
              <Link key={p.slug} href={`/programs/${p.slug}`} className="block">
                <Card className="p-5 transition-colors hover:border-accent-500">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-xl uppercase tracking-wide">{p.name}</h2>
                    {dateRange(p.starts_on, p.ends_on) ? (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {dateRange(p.starts_on, p.ends_on)}
                      </span>
                    ) : null}
                  </div>
                  {p.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
