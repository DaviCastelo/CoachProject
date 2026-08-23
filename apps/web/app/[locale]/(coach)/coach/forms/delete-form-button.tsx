'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteForm } from './actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Props = Readonly<{
  formId: string;
  formName: string;
  submissionCount: number;
}>;

export function DeleteFormButton({ formId, formName, submissionCount }: Props) {
  const t = useTranslations('forms');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasSubmissions = submissionCount > 0;

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteForm(formId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={t('delete')}
      >
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasSubmissions ? t('deleteTitleWithSubmissions') : t('deleteTitle')}
            </DialogTitle>
            <DialogDescription>
              {hasSubmissions
                ? t('deleteBodyWithSubmissions', { name: formName, count: submissionCount })
                : t('deleteBody', { name: formName })}
            </DialogDescription>
          </DialogHeader>

          {hasSubmissions ? (
            <div className="flex gap-3 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <p>{t('deleteWarningSubmissions')}</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {t('deleteCancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-danger text-white hover:bg-danger/90"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? t('deleting') : hasSubmissions ? t('deleteConfirmWithSubmissions') : t('deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
