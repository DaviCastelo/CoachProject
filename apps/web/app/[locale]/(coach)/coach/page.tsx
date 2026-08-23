import { StaticImage } from '@/components/static-image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { ClipboardList, FileText, LayoutGrid, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CoachDashboardPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('coach');
  const db = (await createClient()) as unknown as SupabaseClient;

  const [{ count: regCount }, { count: formCount }, { count: programCount }] = await Promise.all([
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
    db.from('forms').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
    db.from('programs').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
  ]);

  const stats = [
    { label: t('statsRegistrations'), value: regCount ?? 0, icon: ClipboardList, href: '/coach/submissions' },
    { label: t('statsForms'), value: formCount ?? 0, icon: FileText, href: '/coach/forms' },
    { label: t('statsPrograms'), value: programCount ?? 0, icon: LayoutGrid, href: '/programs' },
  ];

  const quickActions = [
    { label: t('viewSubmissions'), href: '/coach/submissions' },
    { label: t('manageForms'), href: '/coach/forms' },
    { label: t('viewPrograms'), href: '/programs' },
  ];

  return (
    <div className="animate-fade-up mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      {/* Hero — banner contido: menos upscale (mais nítido) e proporção ~2:1 (mostra os coaches inteiros) */}
      <section className="relative aspect-[20/9] overflow-hidden rounded-xl border border-ink-700">
        <StaticImage
          src="/images/coaches-field.png"
          alt="Coaches on the field"
          fill
          className="object-cover object-center"
          sizes="(min-width: 896px) 896px, 100vw"
          priority
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p className="text-eyebrow text-accent-500">{ctx.orgName}</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">
            {t('dashboardTitle')}
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-accent-500" aria-hidden="true" />
      </section>

      <div className="space-y-8">
        {/* KPIs clicáveis */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href} className="group block">
                <AthleticCard className="relative h-full p-4 sm:p-5">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500 ring-1 ring-inset ring-accent-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-display text-4xl leading-none sm:text-5xl">{stat.value}</p>
                  <p className="mt-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-accent-500" />
                </AthleticCard>
              </Link>
            );
          })}
        </div>

        {/* Ações rápidas */}
        <div>
          <h2 className="text-eyebrow mb-3 text-muted-foreground">{t('quickActions')}</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button key={action.href} asChild size="sm" variant="outline">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Próximas sessões (vazio por enquanto) */}
        <div>
          <h2 className="text-eyebrow mb-3 text-muted-foreground">{t('upcomingSessions')}</h2>
          <AthleticCard className="p-2">
            <EmptyState
              titleKey="emptyTitle"
              descriptionKey="emptyDescription"
              actionKey="emptyAction"
              namespace="coach"
              iconName="calendar"
            />
          </AthleticCard>
        </div>
      </div>
    </div>
  );
}
