'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  titleKey: string;
  descriptionKey: string;
  actionKey?: string;
  namespace?: 'coach' | 'family';
  imageSrc?: string;
  className?: string;
}

export function EmptyState({
  titleKey,
  descriptionKey,
  actionKey,
  namespace = 'coach',
  imageSrc = '/images/coaches-field.png',
  className,
}: EmptyStateProps) {
  const t = useTranslations(namespace);

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="relative mb-6 h-32 w-48 overflow-hidden rounded-lg border border-ink-700">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover opacity-80"
          sizes="192px"
        />
        <div className="absolute inset-0 border-t-2 border-l-2 border-accent-500" aria-hidden="true" />
      </div>
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
