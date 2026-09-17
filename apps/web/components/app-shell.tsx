'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { AccountMenu } from '@/components/account-menu';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Users,
  CalendarDays,
  Megaphone,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  variant: 'coach' | 'family';
  pendingRegistrations?: number;
}

type NavItem = {
  href:
    | '/coach'
    | '/coach/groups'
    | '/coach/schedule'
    | '/coach/announcements'
    | '/coach/submissions'
    | '/coach/forms'
    | '/family'
    | '/family/groups'
    | '/family/announcements';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export function AppShell({ children, variant, pendingRegistrations }: AppShellProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems: NavItem[] =
    variant === 'coach'
      ? [
          { href: '/coach', label: t('dashboard'), icon: LayoutDashboard },
          { href: '/coach/schedule', label: t('schedule'), icon: CalendarDays },
          { href: '/coach/groups', label: t('groups'), icon: Users },
          {
            href: '/coach/submissions',
            label: t('registrations'),
            icon: ClipboardList,
            badge: pendingRegistrations,
          },
          { href: '/coach/forms', label: t('forms'), icon: FileText },
          { href: '/coach/announcements', label: t('announcements'), icon: Megaphone },
        ]
      : [
          { href: '/family', label: t('schedule'), icon: CalendarDays },
          { href: '/family/groups', label: t('groups'), icon: Users },
          { href: '/family/announcements', label: t('announcements'), icon: Megaphone },
        ];

  function isActive(href: string): boolean {
    const path = pathname.replace(/^\/(en|pt-BR|es)/, '');
    if (href === '/coach' || href === '/family') {
      return path === href || path === `${href}/`;
    }
    return path.startsWith(href);
  }

  const MAX_VISIBLE = 4;
  const primaryItems = variant === 'coach' ? navItems.slice(0, MAX_VISIBLE) : navItems;
  const overflowItems = variant === 'coach' ? navItems.slice(MAX_VISIBLE) : [];
  const overflowActive = overflowItems.some((i) => isActive(i.href));

  return (
    <div className="flex min-h-dvh md:min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-accent-500"
      >
        {t('skipToContent')}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-14 items-center px-4">
          <Link href={variant === 'coach' ? '/coach' : '/family'}>
            <BrandLogo size={32} showName alt={tCommon('appName')} />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label={t('mainNavigation')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                  active
                    ? 'bg-accent-500/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent-500"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href={variant === 'coach' ? '/coach' : '/family'} className="md:hidden">
              <BrandLogo size={32} showName alt={tCommon('appName')} />
            </Link>
            <span className="hidden md:block" />
            <AccountMenu />
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 pb-[calc(var(--spacing-touch)+var(--spacing-safe-bottom))] md:pb-6"
        >
          {children}
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[var(--spacing-safe-bottom)] md:hidden"
        aria-label={t('mainNavigation')}
      >
        {moreOpen && overflowItems.length > 0 ? (
          <div className="border-b border-border">
            {overflowItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex min-h-[var(--spacing-touch)] items-center gap-3 px-4 text-sm transition-colors',
                    isActive(item.href)
                      ? 'text-accent-500'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="flex justify-around">
          {primaryItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-[var(--spacing-touch)] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors',
                  active ? 'text-accent-500' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 bg-accent-500"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative">
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-accent-500" />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}

          {overflowItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn(
                'relative flex min-h-[var(--spacing-touch)] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors',
                moreOpen || overflowActive
                  ? 'text-accent-500'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {overflowActive ? (
                <span
                  className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 bg-accent-500"
                  aria-hidden="true"
                />
              ) : null}
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{t('more')}</span>
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
