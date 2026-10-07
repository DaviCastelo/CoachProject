'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import { AlertTriangle, FilePlus2 } from 'lucide-react';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format-money';
import { createInvoiceFor, type UninvoicedRegistration } from './actions';

/**
 * Inscrições aprovadas que ainda não têm fatura.
 *
 * É a fila de trabalho do admin: inscrição sem fatura é dinheiro que
 * ninguém chegou a pedir. Fica junto da cobrança, e não escondida na tela
 * de inscrições, porque o assunto aqui é dinheiro.
 */
export function Uninvoiced({ registrations }: { registrations: UninvoicedRegistration[] }) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (registrations.length === 0) return null;

  function emit(registration: UninvoicedRegistration) {
    setBusy(registration.id);
    startTransition(async () => {
      const result = await createInvoiceFor(registration.id);
      setBusy(null);
      if (result.ok) {
        toast.success(t('invoiceCreated', { athlete: registration.athleteName }));
        router.refresh();
      } else {
        // A RPC recusa inscrição sem opção de programa: sem preço não há o
        // que cobrar, e inventar valor aqui seria pior que recusar.
        toast.error(
          result.error.includes('opção de programa')
            ? t('invoiceNoPrice')
            : t('invoiceError'),
        );
      }
    });
  }

  return (
    <AthleticCard className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-medium">{t('uninvoicedTitle')}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('uninvoicedBody', { count: registrations.length })}
        </p>
      </div>

      <ul>
        {registrations.map((registration) => {
          const semPreco = registration.priceCents === null;
          return (
            <li
              key={registration.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{registration.athleteName}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {[registration.programName, registration.optionName]
                    .filter(Boolean)
                    .join(' · ') || t('noProgram')}
                </span>
                {semPreco ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t('invoiceNoPrice')}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 font-semibold tabular-nums">
                {semPreco ? '—' : formatMoney(registration.priceCents!, locale)}
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() => emit(registration)}
                disabled={semPreco || busy === registration.id}
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                {busy === registration.id ? t('invoiceCreating') : t('invoiceAction')}
              </Button>
            </li>
          );
        })}
      </ul>
    </AthleticCard>
  );
}
