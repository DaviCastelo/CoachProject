'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
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

export function DeleteFormButton({ formId, formName }: { formId: string; formName: string }) {
  const t = useTranslations('forms');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteForm(formId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error === 'has_submissions' ? t('deleteBlocked') : res.error);
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
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteBody', { name: formName })}</DialogDescription>
          </DialogHeader>

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
              {pending ? t('deleting') : t('deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
