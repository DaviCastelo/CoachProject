'use client';

import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  titleKey: string;
  descriptionKey: string;
  actionKey?: string;
  namespace?: 'coach' | 'family';
}

export function EmptyState({
  titleKey,
  descriptionKey,
  actionKey,
  namespace = 'coach',
}: EmptyStateProps) {
  const t = useTranslations(namespace);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Shield className="h-10 w-10 text-accent-500" />
      </div>
      <h2 className="text-2xl font-display uppercase tracking-wide mb-2">{t(titleKey)}</h2>
      <p className="text-muted-foreground max-w-sm mb-6">{t(descriptionKey)}</p>
      {actionKey && (
        <Button variant="default" disabled>
          {t(actionKey)}
        </Button>
      )}
    </div>
  );
}
