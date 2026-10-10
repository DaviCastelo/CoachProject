'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import { AlertTriangle, BellRing, Check, Clock, Mail, X } from 'lucide-react';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { sendOverdueReminders, type NotificationQueue } from './actions';

/**
 * Caixa de saída de e-mail.
 *
 * Existe porque a conta Resend ainda não foi aberta. Sem esta tela, as
 * mensagens ficariam acumulando num canto do banco e ninguém saberia que a
 * família nunca recebeu o link de pagamento. Aqui o admin vê exatamente o
 * que está parado e por quê.
 */
export function NotificationQueuePanel({ queue }: { queue: NotificationQueue }) {
  const t = useTranslations('payments');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remind() {
    startTransition(async () => {
      const result = await sendOverdueReminders();
      if (result.ok) {
        toast.success(
          result.count > 0 ? t('remindersQueued', { count: result.count }) : t('remindersNone'),
        );
        router.refresh();
      } else {
        toast.error(t('remindersError'));
      }
    });
  }

  const nada = queue.recent.length === 0 && queue.pending === 0;

  return (
    <AthleticCard className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {t('outboxTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('outboxCounts', {
              pending: queue.pending,
              sent: queue.sent,
              failed: queue.failed,
            })}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={remind} disabled={pending}>
          <BellRing className="h-4 w-4" aria-hidden="true" />
          {pending ? t('remindersSending') : t('remindersAction')}
        </Button>
      </div>

      {!queue.configured ? (
        // O estado de hoje. Dito de forma que não pareça defeito, porque não
        // é: falta a conta, não falta o código.
        <div className="border-b border-border bg-warning/5 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t('outboxNotConfigured')}
              {queue.missing.length > 0 ? (
                <span className="mt-1 block font-mono text-xs opacity-80">
                  {queue.missing.join(', ')}
                </span>
              ) : null}
            </span>
          </p>
        </div>
      ) : null}

      {nada ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('outboxEmpty')}</p>
      ) : (
        <ul>
          {queue.recent.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <StatusIcon status={item.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.subject}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.recipient}
                </span>
                {item.error ? (
                  <span className="mt-1 block text-xs text-danger">{item.error}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                {t(`outboxStatus_${item.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AthleticCard>
  );
}

function StatusIcon({ status }: { status: string }) {
  const common = 'mt-0.5 h-4 w-4 shrink-0';
  if (status === 'sent') return <Check className={`${common} text-success`} aria-hidden="true" />;
  if (status === 'failed') return <X className={`${common} text-danger`} aria-hidden="true" />;
  if (status === 'skipped')
    return <X className={`${common} text-muted-foreground`} aria-hidden="true" />;
  return <Clock className={`${common} text-warning`} aria-hidden="true" />;
}
