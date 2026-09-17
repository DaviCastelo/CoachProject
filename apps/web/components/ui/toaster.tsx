'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      duration={4000}
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: 'border-border bg-card text-card-foreground',
          title: 'text-card-foreground',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
