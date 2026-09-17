'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Check, Globe, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { usePathname, useRouter, routing } from '@/i18n/routing';
import { ProfileButton } from '@/components/profile-button';
import { Button } from '@/components/ui/button';

const LABELS: Record<string, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
};

export function AccountMenu() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const locale = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function chooseLocale(next: string) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('accountMenu')}
      >
        <UserRound className="h-5 w-5" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-52 overflow-hidden rounded-md border bg-card text-card-foreground"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
          >
            <UserRound className="h-5 w-5" />
            {tProfile('title')}
          </button>

          <div className="border-t border-border px-3 py-2">
            <p className="mb-1 text-xs text-muted-foreground">{tCommon('language')}</p>
            {routing.locales.map((l) => (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                onClick={() => chooseLocale(l)}
                className="flex w-full items-center justify-between gap-3 rounded px-1 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {LABELS[l] ?? l}
                </span>
                {l === locale ? <Check className="h-4 w-4 text-accent-500" /> : null}
              </button>
            ))}
          </div>

          <div className="border-t border-border px-3 py-2">
            <p className="mb-1 text-xs text-muted-foreground">{tCommon('theme')}</p>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {resolvedTheme === 'dark' ? tCommon('lightTheme') : tCommon('darkTheme')}
            </button>
          </div>

          <form action="/auth/signout" method="post" className="border-t border-border">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-5 w-5" />
              {t('logout')}
            </button>
          </form>
        </div>
      ) : null}

      <ProfileButton hideTrigger open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
