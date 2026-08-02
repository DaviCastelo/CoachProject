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

export default function NewFormPage() {
  const t = useTranslations('forms');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState('registration');
  const [requiresWaiver, setRequiresWaiver] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const slugPreview = slugify(name) || '—';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createForm({
        name,
        type,
        requires_waiver: requiresWaiver,
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
      <h1 className="mb-6 font-display text-3xl uppercase tracking-wide">{t('createTitle')}</h1>

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

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
