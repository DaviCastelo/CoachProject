'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { slugify } from '@ca-tempo/domain';
import { createForm } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FORM_TYPES = [
  { value: 'registration', labelKey: 'typeRegistration' as const },
  { value: 'evaluation', labelKey: 'typeEvaluation' as const },
  { value: 'survey', labelKey: 'typeSurvey' as const },
  { value: 'intake', labelKey: 'typeIntake' as const },
];

export type ProgramChoice = { id: string; name: string };

export function NewFormForm({ programs }: { programs: ProgramChoice[] }) {
  const t = useTranslations('forms');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState('registration');
  const [requiresWaiver, setRequiresWaiver] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [programId, setProgramId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const slugPreview = slugify(name) || '—';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiresPayment && !programId) {
      setError(t('programRequired'));
      return;
    }
    startTransition(async () => {
      const res = await createForm({
        name,
        type,
        requires_waiver: requiresWaiver,
        requires_payment: requiresPayment,
        program_id: requiresPayment ? programId : null,
        success_message: successMessage || undefined,
      });
      if (res.ok) {
        router.push(`/coach/forms/${res.id}/edit`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg p-4">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('createTitle')}</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('slugPreview')}</Label>
            <p className="text-sm text-muted-foreground">/register/{slugPreview}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {t(ft.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresWaiver}
              onChange={(e) => setRequiresWaiver(e.target.checked)}
            />
            {t('requiresWaiver')}
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={requiresPayment}
              onChange={(e) => {
                setRequiresPayment(e.target.checked);
                if (!e.target.checked) setProgramId('');
              }}
            />
            <span>
              {t('requiresPayment')}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('requiresPaymentHelp')}
              </span>
            </span>
          </label>

          {requiresPayment ? (
            <div className="space-y-1.5">
              <Label>{t('programLabel')}</Label>
              {programs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noPrograms')}</p>
              ) : (
                <Select value={programId || undefined} onValueChange={setProgramId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('programPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="success">{t('successMessage')}</Label>
            <textarea
              id="success"
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder={t('successMessagePlaceholder')}
            />
          </div>

          <FieldError>{error}</FieldError>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={pending || !name.trim() || (requiresPayment && !programId)}
            >
              {pending ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
