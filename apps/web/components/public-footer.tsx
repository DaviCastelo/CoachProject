import { getTranslations } from 'next-intl/server';

export async function PublicFooter() {
  const t = await getTranslations('common');

  return (
    <footer className="border-t border-ink-800 bg-ink-950 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-center gap-4">
          <span className="h-px flex-1 max-w-[120px] bg-ink-700" />
          <p className="font-display text-sm uppercase tracking-[0.2em] text-ink-300">
            {t('appName')}
          </p>
          <span className="h-px flex-1 max-w-[120px] bg-ink-700" />
        </div>
      </div>
    </footer>
  );
}
