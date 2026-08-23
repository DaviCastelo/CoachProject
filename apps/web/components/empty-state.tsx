'use client';

import { CalendarPlus, ClipboardList, LayoutGrid } from 'lucide-react';
import { StaticImage } from '@/components/static-image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Ícones permitidos (passados por nome, pois props de função não cruzam a fronteira server→client). */
const EMPTY_ICONS = {
  calendar: CalendarPlus,
  clipboard: ClipboardList,
  grid: LayoutGrid,
} as const;

export type EmptyStateIcon = keyof typeof EMPTY_ICONS;

type EmptyStateProps = Readonly<{
  titleKey: string;
  descriptionKey: string;
  actionKey?: string;
  namespace?: 'coach' | 'family';
  imageSrc?: string;
  /** Quando fornecido, mostra um ícone estilizado em vez de uma foto (evita repetir imagens). */
  iconName?: EmptyStateIcon;
  className?: string;
}>;

export function EmptyState({
  titleKey,
  descriptionKey,
  actionKey,
  namespace = 'coach',
  imageSrc = '/images/coaches-field.png',
  iconName,
  className,
}: EmptyStateProps) {
  const t = useTranslations(namespace);
  const Icon = iconName ? EMPTY_ICONS[iconName] : null;

  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}>
      {Icon ? (
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-800 to-ink-950">
          <div
            className="absolute inset-0 rounded-2xl border-t-2 border-l-2 border-accent-500/80"
            aria-hidden="true"
          />
          <Icon className="h-10 w-10 text-accent-500" strokeWidth={1.5} />
        </div>
      ) : (
        <div className="relative mb-6 h-32 w-48 overflow-hidden rounded-lg border border-ink-700">
          <StaticImage src={imageSrc} alt="" fill className="object-cover opacity-80" sizes="192px" />
          <div
            className="absolute inset-0 border-t-2 border-l-2 border-accent-500"
            aria-hidden="true"
          />
        </div>
      )}
      <h2 className="mb-2 font-display text-2xl uppercase tracking-wide">{t(titleKey)}</h2>
      <p className="mb-6 max-w-sm text-muted-foreground">{t(descriptionKey)}</p>
      {actionKey && (
        <Button variant="default" disabled>
          {t(actionKey)}
        </Button>
      )}
    </div>
  );
}
