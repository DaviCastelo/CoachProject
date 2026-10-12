'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/copy-button';
import { formatMoney } from '@/lib/format-money';
import { formatDate } from '@/lib/format-datetime';
import { markPaidBulk, type PendingInvoice } from './actions';

const METHODS = ['venmo', 'cash', 'check', 'zelle'] as const;

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * O link que a família abre para pagar.
 *
 * Até aqui ele não existia em tela nenhuma. A fatura era emitida, o e-mail com
 * o link ia para a fila, e como a fila ainda não envia (falta a conta Resend),
 * a cobrança morria ali: nem online, nem Venmo, porque a tela de instruções
 * mora no mesmo endereço. Quem emitia não tinha como entregar.
 *
 * Sem prefixo de idioma de propósito: o `as-needed` do next-intl resolve pelo
 * navegador de quem abre, e a família não tem por que receber um link em
 * inglês porque o coach estava com a tela em inglês.
 */
function paymentUrl(invoiceId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window === 'undefined' ? '' : window.location.origin);

  return `${base}/pay/${invoiceId}`;
}

export function PendingList({ invoices }: { invoices: PendingInvoice[] }) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<string>('venmo');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        i.athleteName.toLowerCase().includes(q) ||
        i.number.toLowerCase().includes(q) ||
        (i.memo ?? '').toLowerCase().includes(q),
    );
  }, [invoices, query]);

  // Fatura com ACH em compensação não entra em baixa manual: lançar agora
  // criaria pagamento em duplicidade quando o webhook confirmar.
  const selectable = visible.filter((i) => !i.hasPending);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));

  const selectedInvoices = invoices.filter((i) => selected.has(i.id));
  const selectedCents = selectedInvoices.reduce((sum, i) => sum + i.dueCents, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        selectable.forEach((i) => next.delete(i.id));
        return next;
      }
      return new Set([...prev, ...selectable.map((i) => i.id)]);
    });
  }

  function submit() {
    const ids = selectedInvoices.map((i) => i.id);
    startTransition(async () => {
      const result = await markPaidBulk(ids, method);
      if (result.ok) {
        toast.success(t('markedToast', { count: result.count }));
        setSelected(new Set());
      } else {
        toast.error(t('markError'));
      }
    });
  }

  if (invoices.length === 0) {
    return (
      <AthleticCard className="p-8 text-center">
        <p className="font-medium">{t('emptyTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
      </AthleticCard>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
      />

      <AthleticCard className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            disabled={selectable.length === 0}
            aria-label={t('selectAll')}
            className="h-4 w-4 shrink-0 accent-[var(--color-accent-500)]"
          />
          <span className="text-sm text-muted-foreground">
            {t('showing', { count: visible.length, total: invoices.length })}
          </span>
        </div>

        <ul>
          {visible.map((invoice) => {
            const days = daysSince(invoice.createdAt);
            return (
              // O botão de copiar fica FORA do label de propósito: dentro, o
              // clique nele marcaria a fatura para baixa manual, que é o
              // oposto do que a pessoa quis fazer.
              <li
                key={invoice.id}
                className="flex items-start border-b border-border last:border-b-0"
              >
                <label
                  className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                    invoice.hasPending ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(invoice.id)}
                    onChange={() => toggle(invoice.id)}
                    disabled={invoice.hasPending}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-500)]"
                    aria-label={t('selectOne', {
                      athlete: invoice.athleteName,
                      number: invoice.number,
                    })}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{invoice.athleteName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {invoice.number}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {invoice.memo ? `${invoice.memo} · ` : ''}
                      {t('openForDays', { days })}
                      {invoice.dueOn ? ` · ${t('dueOn', { date: formatDate(invoice.dueOn, locale) })}` : ''}
                    </span>
                    {invoice.hasPending ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-warning">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('hasPending')}
                      </span>
                    ) : null}
                  </span>

                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(invoice.dueCents, locale)}
                  </span>
                </label>

                <span className="shrink-0 py-3 pr-4 pl-2">
                  <CopyButton
                    value={paymentUrl(invoice.id)}
                    label={t('copyLinkAria', {
                      athlete: invoice.athleteName,
                      number: invoice.number,
                    })}
                    texts={{ copy: t('copyLink'), copied: t('copiedLink') }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </AthleticCard>

      {selected.size > 0 ? (
        // Barra fixa: com 70 linhas na tela, um botão no rodapé da lista
        // obrigaria a rolar até o fim depois de marcar.
        <div className="sticky bottom-[calc(var(--spacing-touch)+var(--spacing-safe-bottom))] z-10 md:bottom-4">
          <AthleticCard className="flex flex-wrap items-center gap-3 border-accent-500 p-4 shadow-lg">
            <span className="text-sm">
              {t('selectedSummary', {
                count: selected.size,
                amount: formatMoney(selectedCents, locale),
              })}
            </span>

            <span className="ml-auto flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="bulk-method">
                {t('methodLabel')}
              </label>
              <select
                id="bulk-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`method_${m}`)}
                  </option>
                ))}
              </select>

              <Button onClick={submit} disabled={pending}>
                {pending ? t('marking') : t('markAction')}
              </Button>
            </span>
          </AthleticCard>
        </div>
      ) : null}
    </div>
  );
}
