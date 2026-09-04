'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserCog, Eye, EyeOff, KeyRound } from 'lucide-react';
import { getOwnProfile, updateOwnProfile } from '@/lib/actions/profile';
import { changeOwnPassword } from '@/lib/actions/athlete-account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/** Edição do próprio perfil — disponível para admin, coach, staff, família e atleta. */
export function ProfileButton() {
  const t = useTranslations('profile');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    void getOwnProfile().then((p) => {
      if (p) {
        setEmail(p.email);
        setFullName(p.fullName);
        setPhone(p.phone);
      }
      setLoading(false);
    });
  }, [open]);

  function saveInfo() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateOwnProfile({ fullName, phone });
      if (!res.ok) {
        setError(res.error === 'name_required' ? t('errorNameRequired') : res.error);
        return;
      }
      setSuccess(t('saved'));
      router.refresh();
    });
  }

  function savePassword() {
    setError(null);
    setSuccess(null);
    if (password.length < 8) {
      setError(t('errorWeak'));
      return;
    }
    if (password !== confirm) {
      setError(t('errorMismatch'));
      return;
    }
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
      setSuccess(t('passwordChanged'));
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-12 w-12"
        onClick={() => setOpen(true)}
        aria-label={t('title')}
        title={t('title')}
      >
        <UserCog className="h-8 w-8" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => {
                setTab('info');
                setError(null);
                setSuccess(null);
              }}
              className={`border-b-2 px-3 py-2 text-sm ${
                tab === 'info'
                  ? 'border-accent-500 text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {t('tabInfo')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('password');
                setError(null);
                setSuccess(null);
              }}
              className={`border-b-2 px-3 py-2 text-sm ${
                tab === 'password'
                  ? 'border-accent-500 text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {t('tabPassword')}
            </button>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('loading')}</p>
          ) : tab === 'info' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name">{t('fullName')}</Label>
                <Input
                  id="pf-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-phone">{t('phone')}</Label>
                <Input
                  id="pf-phone"
                  value={phone}
                  placeholder="+1 555 000 0000"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-email">{t('email')}</Label>
                <Input id="pf-email" value={email} disabled />
                <p className="text-xs text-muted-foreground">{t('emailLocked')}</p>
              </div>

              {error ? <p className="text-sm text-danger">{error}</p> : null}
              {success ? <p className="text-sm text-success">{success}</p> : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-pw">{t('newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="pf-pw"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-confirm">{t('confirmPassword')}</Label>
                <Input
                  id="pf-confirm"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error ? <p className="text-sm text-danger">{error}</p> : null}
              {success ? <p className="text-sm text-success">{success}</p> : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t('close')}
            </Button>
            {tab === 'info' ? (
              <Button size="sm" onClick={saveInfo} disabled={pending || !fullName.trim()}>
                {pending ? t('saving') : t('save')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={savePassword}
                disabled={pending || password.length < 8 || confirm.length === 0}
              >
                <KeyRound className="h-4 w-4" />
                {pending ? t('saving') : t('changePassword')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
