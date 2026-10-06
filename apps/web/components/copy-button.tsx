'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Copia um texto curto (o @ do Venmo, o número da fatura) para a área de
 * transferência. No celular, que é onde a família vai abrir essa página,
 * copiar à mão um @ é justamente onde se erra o destinatário.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations('pay');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Navegador sem permissão de clipboard (ou contexto inseguro): o valor
      // continua visível na tela para copiar na mão, então não há o que fazer
      // além de não quebrar.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      aria-label={`${label}: ${value}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
          {t('copied')}
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t('copy')}
        </>
      )}
    </Button>
  );
}
