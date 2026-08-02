import { StaticImage } from '@/components/static-image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { ClipboardList, FileText, LayoutGrid } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CoachDashboardPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('coach');
  const db = (await createClient()) as unknown as SupabaseClient;

  const [{ count: regCount }, { count: formCount }, { count: programCount }] = await Promise.all([
    db
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId),
    db.from('forms').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
    db.from('programs').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
  ]);

  const stats = [
    { label: t('statsRegistrations'), value: regCount ?? 0, icon: ClipboardList },
    { label: t('statsForms'), value: formCount ?? 0, icon: FileText },
    { label: t('statsPrograms'), value: programCount ?? 0, icon: LayoutGrid },
  ];

  return (
    <div>
      <div className="relative h-40 overflow-hidden">
        <StaticImage
          src="/images/coaches-field.png"
          alt="Coaches on the field"
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="hero-overlay-compact absolute inset-0" />
        <div className="absolute inset-0 flex items-end p-4">
          <h1 className="font-display text-3xl uppercase tracking-wide">{t('dashboardTitle')}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <AthleticCard key={stat.label} className="p-4 text-center">
                <Icon className="mx-auto mb-2 h-5 w-5 text-accent-500" />
                <p className="font-display text-2xl">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </AthleticCard>
            );
          })}
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide">{t('quickActions')}</h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/coach/submissions">{t('viewSubmissions')}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/coach/forms">{t('manageForms')}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/programs">{t('viewPrograms')}</Link>
            </Button>
          </div>
        </div>

        <EmptyState
          titleKey="emptyTitle"
          descriptionKey="emptyDescription"
          actionKey="emptyAction"
          namespace="coach"
        />
      </div>
    </div>
  );
}
