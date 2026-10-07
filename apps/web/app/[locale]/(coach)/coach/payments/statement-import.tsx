'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileUp, HelpCircle } from 'lucide-react';
import type { StatementMatch, MatchStatus } from '@ca-tempo/domain';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format-money';
import { previewStatement, confirmStatementImport } from './actions';

/**
 * Importa o extrato do Venmo em CSV e casa com as faturas em aberto.
 *
 * Duas etapas de propósito: ler e mostrar, depois confirmar. Importar direto
 * seria mais rápido e, no primeiro arquivo de formato inesperado, daria baixa
 * em fatura errada — dinheiro é onde desfazer custa caro.
 */
export function StatementImport() {
  const t = useTranslations('payments');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [matches, setMatches] = useState<StatementMatch[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    startTransition(async () => {
      const result = await previewStatement(text);
      if (!result.ok) {
        toast.error(t(`importError_${result.error}`));
        setMatches(null);
        return;
      }

      setMatches(result.matches);
      setSkipped(result.skipped);
      // Só o que casou com valor exato vem pré-marcado. O resto exige um
      // clique consciente, porque é onde mora o erro caro.
      setChosen(
        new Set(
          result.matches
            .map((m, index) => (m.status === 'matched' ? index : -1))
            .filter((index) => index >= 0),
        ),
      );
    });
  }

  function toggle(index: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function confirm() {
    if (!matches) return;

    const items = [...chosen]
      .map((index) => matches[index])
      .filter((match) => match.invoice !== null)
      .map((match) => ({
        invoiceId: match.invoice!.id,
        // Referência rastreável: data e id da transação no extrato. Sem isso,
        // conferir meses depois vira arqueologia.
        reference: `Venmo ${match.row.date ?? ''} ${match.row.externalId ? `#${match.row.externalId}` : ''}`.trim(),
      }));

    startTransition(async () => {
      const result = await confirmStatementImport(items);
      if (result.ok) {
        toast.success(t('importedToast', { count: result.count }));
        setMatches(null);
        setChosen(new Set());
        if (inputRef.current) inputRef.current.value = '';
        // A lista de pendentes é server component: recarregar a rota é o que
        // faz as faturas quitadas sumirem dela.
        router.refresh();
      } else {
        toast.error(t('markError'));
      }
    });
  }

  const chosenCents = matches
    ? [...chosen].reduce((sum, index) => sum + (matches[index]?.row.amountCents ?? 0), 0)
    : 0;

  return (
    <AthleticCard className="p-5">
      <h2 className="font-medium">{t('importTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('importBody')}</p>

      <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-card border border-dashed border-border px-4 py-6 text-sm transition-colors hover:border-accent-500 hover:bg-accent-500/5">
        <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t('importPick')}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={pending}
          className="sr-only"
        />
      </label>

      {matches ? (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            {t('importSummary', { read: matches.length, skipped })}
          </p>

          <ul className="mt-3 divide-y divide-border rounded-card border border-border">
            {matches.map((match, index) => (
              <li key={`${match.row.line}-${index}`} className="px-3 py-2.5">
                <label
                  className={`flex items-start gap-3 ${
                    match.invoice ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={chosen.has(index)}
                    onChange={() => toggle(index)}
                    disabled={!match.invoice || match.status === 'duplicate'}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-500)]"
                    aria-label={match.row.note || t('noNote')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">
                        {/* `||` e não `??`: nome vazio no banco e nome ausente
                            devem cair no mesmo lugar. */}
                        {match.invoice?.athleteName || match.row.from || t('unknownSender')}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {match.row.note || t('noNote')}
                      </span>
                    </span>
                    <StatusLine status={match.status} match={match} locale={locale} />
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(match.row.amountCents, locale)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm">
              {t('selectedSummary', {
                count: chosen.size,
                amount: formatMoney(chosenCents, locale),
              })}
            </span>
            <Button
              onClick={confirm}
              disabled={pending || chosen.size === 0}
              className="ml-auto"
            >
              {pending ? t('marking') : t('importConfirm')}
            </Button>
          </div>
        </div>
      ) : null}
    </AthleticCard>
  );
}

function StatusLine({
  status,
  match,
  locale,
}: {
  status: MatchStatus;
  match: StatementMatch;
  locale: string;
}) {
  const t = useTranslations('payments');

  if (status === 'matched') {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-sm text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('matchOk', { number: match.invoice?.number ?? '' })}
      </span>
    );
  }

  if (status === 'amount_mismatch') {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-sm text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('matchAmount', {
          number: match.invoice?.number ?? '',
          due: formatMoney(match.invoice?.dueCents ?? 0, locale),
        })}
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t(`match_${status}`)}
    </span>
  );
}
