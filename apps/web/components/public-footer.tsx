import { getTranslations } from 'next-intl/server';

const INSTAGRAM_URL = 'https://www.instagram.com/catempotraining';
const CONTACT_MAILTO = 'mailto:hello@catempotraining.com';

export async function PublicFooter() {
  const t = await getTranslations('common');

  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {t('appName')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-accent-500"
          >
            {t('instagram')}
          </a>
          <a
            href={CONTACT_MAILTO}
            className="text-muted-foreground transition-colors hover:text-accent-500"
          >
            {t('contact')}
          </a>
        </div>
      </div>
    </footer>
  );
}
