'use client';

import { CalendarPlus, ClipboardList, LayoutGrid } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EMPTY_ICONS = {
  calendar: CalendarPlus,
  clipboard: ClipboardList,
  grid: LayoutGrid,
} as const;

export type EmptyStateIcon = keyof typeof EMPTY_ICONS;

type EmptyStateProps = Readonly<{
  titleKey: string;
  descriptionKey?: string;
  actionKey?: string;
  actionHref?: string;
  namespace?: string;
  iconName?: EmptyStateIcon;
  className?: string;
}>;

export function EmptyState({
  titleKey,
  descriptionKey,
  actionKey,
  actionHref,
  namespace = 'coach',
  iconName = 'calendar',
  className,
}: EmptyStateProps) {
  const t = useTranslations(namespace);
  const Icon = EMPTY_ICONS[iconName];

  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}>
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted">
        <span className="absolute left-0 top-0 h-[3px] w-8 bg-accent-500" aria-hidden="true" />
        <Icon className="h-8 w-8 text-accent-500" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">{t(titleKey)}</h2>
      {descriptionKey ? (
        <p className="mb-6 max-w-sm text-muted-foreground">{t(descriptionKey)}</p>
      ) : null}
      {actionKey && actionHref ? (
        <Button asChild>
          <Link href={actionHref}>{t(actionKey)}</Link>
        </Button>
      ) : null}
    </div>
  );
}
