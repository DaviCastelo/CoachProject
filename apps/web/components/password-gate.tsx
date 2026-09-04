'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { changeOwnPassword } from '@/lib/actions/athlete-account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Bloqueio de primeiro acesso: a senha foi criada por um coach/admin e é
 * temporária. Não há como fechar — só sai trocando a senha de verdade.
 */
export function PasswordGate() {
  const t = useTranslations('account');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = !tooShort && !mismatch && confirm.length > 0 && !pending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await changeOwnPassword(password);
      if (!res.ok) {
        const map: Record<string, string> = {
          weak_password: t('errorWeak'),
          same_password: t('errorSame'),
        };
        setError(map[res.error] ?? res.error);
        return;
      }
      setPassword('');
      setConfirm('');
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg border border-ink-700 bg-card p-6 shadow-lg accent-border-top">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide">{t('changeTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('changeSubtitle')}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="pg-new">{t('newPassword')}</Label>
            <div className="relative">
              <Input
                id="pg-new"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={show ? t('hide') : t('show')}
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tooShort && password.length > 0 ? (
              <p className="text-xs text-warning">{t('errorWeak')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pg-confirm">{t('confirmPassword')}</Label>
            <Input
              id="pg-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch ? <p className="text-xs text-danger">{t('errorMismatch')}</p> : null}
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            <KeyRound className="h-4 w-4" />
            {pending ? t('saving') : t('changeAction')}
          </Button>
        </form>
      </div>
    </div>
  );
}
