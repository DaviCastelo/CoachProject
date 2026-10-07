'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AthleticCard } from '@/components/athletic-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { savePaymentSettings, type PaymentSettings } from '../actions';

const MODES = ['timed', 'none', 'unlimited'] as const;

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const t = useTranslations('payments');
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PaymentSettings>(initial);

  function set<K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await savePaymentSettings(form);
      if (result.ok) toast.success(t('settingsSaved'));
      else toast.error(t('settingsError'));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <AthleticCard className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">{t('setVenmoTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('setVenmoBody')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venmo">{t('setVenmoHandle')}</Label>
          <Input
            id="venmo"
            value={form.venmoHandle}
            onChange={(e) => set('venmoHandle', e.target.value)}
            placeholder="@CA-Tempo-Training"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t('setVenmoHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">{t('setNoteLabel')}</Label>
          <textarea
            id="note"
            value={form.offlineNote}
            onChange={(e) => set('offlineNote', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('setNotePlaceholder')}
          />
        </div>
      </AthleticCard>

      <AthleticCard className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">{t('setWhoTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('setWhoBody')}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.coachCanRecord}
            onChange={(e) => set('coachCanRecord', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-500)]"
          />
          <span className="text-sm">{t('setCoachCanRecord')}</span>
        </label>
      </AthleticCard>

      <AthleticCard className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">{t('setReservationTitle')}</h2>
          {/* O dilema real: sem reserva, a família paga e descobre que
              lotou; com reserva infinita, alguém trava a vaga e nunca paga. */}
          <p className="mt-1 text-sm text-muted-foreground">{t('setReservationBody')}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">{t('setReservationTitle')}</legend>
          {MODES.map((mode) => (
            <label
              key={mode}
              className="flex cursor-pointer items-start gap-3 rounded-card border border-border p-3 transition-colors hover:bg-muted/40 has-[:checked]:border-accent-500 has-[:checked]:bg-accent-500/5"
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="reservation"
                  checked={form.reservationMode === mode}
                  onChange={() => set('reservationMode', mode)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-ink-400 peer-checked:border-[5px] peer-checked:border-accent-500 dark:border-ink-600"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t(`setRes_${mode}`)}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t(`setResBody_${mode}`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {form.reservationMode === 'timed' ? (
          <div className="space-y-1.5">
            <Label htmlFor="hours">{t('setResHours')}</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={1440}
              value={form.reservationHours}
              onChange={(e) => set('reservationHours', Number(e.target.value))}
              className="max-w-32"
            />
          </div>
        ) : null}
      </AthleticCard>

      <Button type="submit" disabled={pending}>
        {pending ? t('settingsSaving') : t('settingsSave')}
      </Button>
    </form>
  );
}
