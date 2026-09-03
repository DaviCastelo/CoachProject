'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  LayoutDashboard,
  ClipboardList,
  FileText,
  Users,
  CalendarDays,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  variant: 'coach' | 'family';
}

type NavItem = {
  href:
    | '/coach'
    | '/coach/groups'
    | '/coach/schedule'
    | '/coach/announcements'
    | '/coach/submissions'
    | '/coach/forms'
    | '/family';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppShell({ children, variant }: AppShellProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  const navItems: NavItem[] =
    variant === 'coach'
      ? [
          { href: '/coach', label: t('dashboard'), icon: LayoutDashboard },
          { href: '/coach/groups', label: t('groups'), icon: Users },
          { href: '/coach/schedule', label: t('schedule'), icon: CalendarDays },
          { href: '/coach/announcements', label: t('announcements'), icon: Megaphone },
          { href: '/coach/submissions', label: t('registrations'), icon: ClipboardList },
          { href: '/coach/forms', label: t('forms'), icon: FileText },
        ]
      : [{ href: '/family', label: t('dashboard'), icon: LayoutDashboard }];

  function isActive(href: string): boolean {
    const path = pathname.replace(/^\/(en|pt-BR|es)/, '');
    if (href === '/coach' || href === '/family') {
      return path === href || path === `${href}/`;
    }
    return path.startsWith(href);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-ink-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href={variant === 'coach' ? '/coach' : '/family'}>
            <BrandLogo size={36} showName alt={tCommon('appName')} />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="icon" type="submit" aria-label={t('logout')}>
                <LogOut className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-ink-800 bg-background">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex min-h-[var(--spacing-touch)] flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                  active ? 'text-accent-500' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-accent-500"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
