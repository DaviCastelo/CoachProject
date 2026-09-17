import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export async function PublicHeader() {
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo size={32} showName alt={t('appName')} />
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="h-11">
            <Link href="/programs">{t('programs')}</Link>
          </Button>
          <Button asChild size="sm" className="h-11">
            <Link href="/login">{tAuth('login')}</Link>
          </Button>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
