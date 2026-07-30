'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  variant: 'coach' | 'family';
}

export function AppShell({ children, variant }: AppShellProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const navItems =
    variant === 'coach'
      ? [
          { href: '/coach', label: t('dashboard') },
          { href: '/coach/schedule', label: t('schedule') },
          { href: '/coach/athletes', label: t('athletes') },
          { href: '/coach/settings', label: t('settings') },
        ]
      : [
          { href: '/family', label: t('schedule') },
          { href: '/family/athletes', label: t('athletes') },
          { href: '/family/account', label: t('account') },
        ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href={variant === 'coach' ? '/coach' : '/family'} className="flex items-center gap-2">
            <Image src="/icons/shield.svg" alt={tCommon('appName')} width={32} height={32} />
            <span className="font-display text-lg uppercase tracking-wide hidden sm:inline">
              CA Tempo
            </span>
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[var(--spacing-touch)] flex-1 flex-col items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
