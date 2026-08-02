import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';

export default async function LandingPage() {
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between px-4 border-b">
        <div className="flex items-center gap-2">
          <Image src="/icons/shield.svg" alt={t('appName')} width={32} height={32} />
          <span className="font-display text-lg uppercase tracking-wide">CA Tempo</span>
        </div>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Image src="/icons/shield.svg" alt="" width={80} height={80} className="mb-8" />
        <h1 className="text-4xl font-display uppercase tracking-wide mb-4 md:text-6xl">
          {t('appName')}
        </h1>
        <p className="text-muted-foreground max-w-md mb-8 text-lg">
          Private training, small groups and seasonal camps — all in one platform.
        </p>
        <Button asChild size="lg">
          <Link href="/login">{tAuth('login')}</Link>
        </Button>
      </main>
    </div>
  );
}
