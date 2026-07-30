'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('locale');

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  const currentIndex = routing.locales.indexOf(locale as 'en' | 'pt-BR' | 'es');
  const nextLocale = routing.locales[(currentIndex + 1) % routing.locales.length];

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => switchLocale(nextLocale)}
      aria-label={`Switch language to ${t(nextLocale as 'en' | 'pt-BR' | 'es')}`}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase text-xs">{locale === 'pt-BR' ? 'PT' : locale.toUpperCase()}</span>
    </Button>
  );
}
