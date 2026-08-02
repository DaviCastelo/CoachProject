import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export async function PublicHeader() {
  const t = await getTranslations('common');

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo size={36} showName alt={t('appName')} />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
