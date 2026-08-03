'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { isFieldVisible, validateSubmission, type FormSchema, type FormField } from '@ca-tempo/domain';
import { SectionStep } from '@/components/forms/form-renderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { submitRegistration } from './actions';
import { SignaturePad } from './signature-pad';

export type ProgramOption = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
};
export type WaiverInfo = { id: string; name: string; body: string };

type SubmitErrorCode = 'closed' | 'incomplete_mapping' | 'config_error' | 'not_found' | 'server_error';

function submitErrorMessageKey(error: SubmitErrorCode): 'closed' | 'incompleteMapping' | 'configError' | 'genericError' {
  if (error === 'closed') return 'closed';
  if (error === 'incomplete_mapping') return 'incompleteMapping';
  if (error === 'config_error') return 'configError';
  return 'genericError';
}

type Props = Readonly<{
  formVersionId: string;
  schema: FormSchema;
  successMessage: string | null;
  options: ProgramOption[];
  waiver: WaiverInfo | null;
}>;

type Values = Record<string, unknown>;
type Step = { kind: 'section'; index: number } | { kind: 'options' } | { kind: 'waiver' };

function defaultValueFor(field: FormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getSubmitLabel(
  isLast: boolean,
  pending: boolean,
  t: ReturnType<typeof useTranslations<'register'>>,
): string {
  if (!isLast) return t('next');
  if (pending) return t('submitting');
  return t('submit');
}

type OptionsStepProps = Readonly<{
  options: ProgramOption[];
  optionId: string | null;
  onSelect: (id: string) => void;
  locale: string;
  label: string;
}>;

function OptionsStep({ options, optionId, onSelect, locale, label }: OptionsStepProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-xl uppercase tracking-wide">{label}</legend>
      {options.map((opt) => (
        <label
          key={opt.id}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3"
        >
          <input
            type="radio"
            name="pass"
            className="mt-1"
            checked={optionId === opt.id}
            onChange={() => onSelect(opt.id)}
          />
          <span className="flex-1">
            <span className="flex justify-between font-medium">
              <span>{opt.name}</span>
              <span>{formatPrice(opt.price_cents, locale)}</span>
            </span>
            {opt.description ? (
              <span className="block text-sm text-muted-foreground">{opt.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

type WaiverStepProps = Readonly<{
  waiver: WaiverInfo;
  scrolledEnd: boolean;
  onScrolledEnd: () => void;
  sigType: 'drawn' | 'typed';
  onSigTypeChange: (type: 'drawn' | 'typed') => void;
  onSigDataChange: (data: string | null) => void;
  typedName: string;
  onTypedNameChange: (name: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  t: ReturnType<typeof useTranslations<'register'>>;
}>;

function WaiverStep({
  waiver,
  scrolledEnd,
  onScrolledEnd,
  sigType,
  onSigTypeChange,
  onSigDataChange,
  typedName,
  onTypedNameChange,
  consent,
  onConsentChange,
  t,
}: WaiverStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl uppercase tracking-wide">{waiver.name}</h2>
      <div
        className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-input p-3 text-sm"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) onScrolledEnd();
        }}
      >
        {waiver.body}
      </div>
      {!scrolledEnd ? <p className="text-xs text-muted-foreground">{t('scrollToEnd')}</p> : null}

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={sigType === 'drawn'} onChange={() => onSigTypeChange('drawn')} />
          {t('drawSignature')}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={sigType === 'typed'} onChange={() => onSigTypeChange('typed')} />
          {t('typeName')}
        </label>
      </div>

      {sigType === 'drawn' ? (
        <SignaturePad onChange={onSigDataChange} />
      ) : (
        <Input
          placeholder={t('typeNamePlaceholder')}
          value={typedName}
          onChange={(e) => onTypedNameChange(e.target.value)}
        />
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
        />
        {t('consent')}
      </label>
    </div>
  );
}

export function RegisterForm({ formVersionId, schema, successMessage, options, waiver }: Props) {
  const t = useTranslations('register');
  const locale = useLocale();
  const { register, watch, getValues, setValue } = useForm<Values>({
    defaultValues: useMemo(() => {
      const dv: Values = {};
      for (const section of schema.sections) {
        for (const field of section.fields) dv[field.id] = defaultValueFor(field);
      }
      return dv;
    }, [schema]),
  });

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = schema.sections.map((_, index) => ({ kind: 'section', index }));
    if (options.length > 0) s.push({ kind: 'options' });
    if (waiver) s.push({ kind: 'waiver' });
    return s;
  }, [schema, options.length, waiver]);

  const [stepIdx, setStepIdx] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const [optionId, setOptionId] = useState<string | null>(null);
  const [sigType, setSigType] = useState<'drawn' | 'typed'>('drawn');
  const [sigData, setSigData] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [consent, setConsent] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  const values = watch();
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  function validateSection(fields: FormField[]): boolean {
    const scope = new Set(
      fields.filter((f) => isFieldVisible(f, values)).map((f) => f.id),
    );
    const result = validateSubmission(schema, getValues());
    const errors = (result.ok ? [] : result.errors).filter((e) => scope.has(e.fieldId));
    const map: Record<string, string> = {};
    for (const e of errors) map[e.fieldId] = e.message;
    setFieldErrors(map);
    return errors.length === 0;
  }

  function validateWaiverStep(): boolean {
    if (!scrolledEnd) {
      setFormError(t('readWaiver'));
      return false;
    }
    const signed = sigType === 'typed' ? typedName.trim().length > 1 : Boolean(sigData);
    if (!signed) {
      setFormError(t('signWaiver'));
      return false;
    }
    if (!consent) {
      setFormError(t('consentRequired'));
      return false;
    }
    return true;
  }

  function stepValid(): boolean {
    if (step.kind === 'section') return validateSection(schema.sections[step.index].fields);
    if (step.kind === 'options') {
      if (!optionId) {
        setFormError(t('choosePassError'));
        return false;
      }
      return true;
    }
    return validateWaiverStep();
  }

  function goNext() {
    setFormError(null);
    if (!stepValid()) return;
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }

  function submit() {
    setFormError(null);
    if (!stepValid()) return;
    const result = validateSubmission(schema, getValues());
    if (!result.ok) {
      const map: Record<string, string> = {};
      for (const e of result.errors) map[e.fieldId] = e.message;
      setFieldErrors(map);
      setFormError(t('reviewSteps'));
      return;
    }

    startTransition(async () => {
      const res = await submitRegistration(formVersionId, getValues(), {
        programOptionId: optionId,
        waiver: waiver
          ? {
              signatureType: sigType,
              signatureData: sigType === 'typed' ? typedName.trim() : (sigData ?? ''),
              consent,
            }
          : null,
      });
      if (res.ok) {
        setDone(true);
      } else if ('errors' in res) {
        const map: Record<string, string> = {};
        for (const e of res.errors) map[e.fieldId] = e.message;
        setFieldErrors(map);
        setFormError(t('fixFields'));
      } else {
        setFormError(t(submitErrorMessageKey(res.error)));
      }
    });
  }

  function renderStepContent() {
    if (step.kind === 'section') {
      return (
        <SectionStep
          section={schema.sections[step.index]}
          values={values}
          fieldErrors={fieldErrors}
          register={register}
          setValue={setValue}
        />
      );
    }
    if (step.kind === 'options') {
      return (
        <OptionsStep
          options={options}
          optionId={optionId}
          onSelect={setOptionId}
          locale={locale}
          label={t('choosePass')}
        />
      );
    }
    if (waiver) {
      return (
        <WaiverStep
          waiver={waiver}
          scrolledEnd={scrolledEnd}
          onScrolledEnd={() => setScrolledEnd(true)}
          sigType={sigType}
          onSigTypeChange={setSigType}
          onSigDataChange={setSigData}
          typedName={typedName}
          onTypedNameChange={setTypedName}
          consent={consent}
          onConsentChange={setConsent}
          t={t}
        />
      );
    }
    return null;
  }

  if (done) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 font-display text-2xl uppercase tracking-wide">{t('thankYou')}</h2>
        <p className="text-muted-foreground">{successMessage ?? t('defaultSuccess')}</p>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLast) submit();
        else goNext();
      }}
      noValidate
    >
      {steps.length > 1 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('step', { current: stepIdx + 1, total: steps.length })}
        </p>
      ) : null}

      <Card className="space-y-4 p-6">{renderStepContent()}</Card>

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0 || pending}
        >
          {t('back')}
        </Button>
        <Button type="submit" disabled={pending}>
          {getSubmitLabel(isLast, pending, t)}
        </Button>
      </div>
    </form>
  );
}
