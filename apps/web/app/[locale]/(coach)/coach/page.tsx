import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { formatDateTime } from '@/lib/format-datetime';
import { listSessions } from './schedule/actions';
import { ClipboardList, FileText, LayoutGrid, ArrowUpRight, Check, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CoachDashboardPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const t = await getTranslations('coach');
  const locale = await getLocale();
  const db = (await createClient()) as unknown as SupabaseClient;

  const [{ count: regCount }, { count: formCount }, { count: programCount }, sessions] =
    await Promise.all([
      db.from('registrations').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
      db.from('forms').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
      db.from('programs').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId),
      listSessions(),
    ]);

  const now = Date.now();
  const upcoming = sessions
    .filter((s) => new Date(s.endsAt).getTime() >= now && s.status !== 'canceled')
    .slice(0, 3);

  const stats = [
    { label: t('statsRegistrations'), value: regCount ?? 0, icon: ClipboardList, href: '/coach/submissions' as const },
    { label: t('statsForms'), value: formCount ?? 0, icon: FileText, href: '/coach/forms' as const },
    { label: t('statsPrograms'), value: programCount ?? 0, icon: LayoutGrid, href: '/programs' as const },
  ];

  return (
    <PageContainer className="space-y-8 py-6">
      <header>
        <p className="text-eyebrow text-accent-700 dark:text-accent-500">{ctx.orgName}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('dashboardTitle')}</h1>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className="group block">
              <AthleticCard className="relative h-full p-4 sm:p-5">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500 ring-1 ring-inset ring-accent-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-4xl font-semibold leading-none sm:text-5xl">{stat.value}</p>
                <p className="mt-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-accent-500" />
              </AthleticCard>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="text-eyebrow mb-3 text-muted-foreground">{t('upcomingSessions')}</h2>
        {upcoming.length === 0 ? (
          <AthleticCard className="p-2">
            <EmptyState
              titleKey="emptyTitle"
              descriptionKey="emptyDescription"
              actionKey="emptyAction"
              actionHref="/coach/schedule"
              namespace="coach"
              iconName="calendar"
            />
          </AthleticCard>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <Link key={s.id} href={`/coach/schedule/${s.id}`} className="block">
                <AthleticCard className="p-4">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDateTime(s.startsAt, locale)}
                    {s.groupNames.length > 0 ? ` · ${s.groupNames.join(', ')}` : ''}
                  </p>
                  <p className="mt-2 flex gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check className="h-3.5 w-3.5" />
                      {s.going}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {s.noReply}
                    </span>
                  </p>
                </AthleticCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
