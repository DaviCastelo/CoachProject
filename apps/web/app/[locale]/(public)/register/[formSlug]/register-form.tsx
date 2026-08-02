'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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

type Props = {
  formVersionId: string;
  schema: FormSchema;
  successMessage: string | null;
  options: ProgramOption[];
  waiver: WaiverInfo | null;
};

type Values = Record<string, unknown>;
type Step = { kind: 'section'; index: number } | { kind: 'options' } | { kind: 'waiver' };

function defaultValueFor(field: FormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function RegisterForm({ formVersionId, schema, successMessage, options, waiver }: Props) {
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
    const scope = fields.filter((f) => isFieldVisible(f, values)).map((f) => f.id);
    const result = validateSubmission(schema, getValues());
    const errors = (result.ok ? [] : result.errors).filter((e) => scope.includes(e.fieldId));
    const map: Record<string, string> = {};
    for (const e of errors) map[e.fieldId] = e.message;
    setFieldErrors(map);
    return errors.length === 0;
  }

  function stepValid(): boolean {
    if (step.kind === 'section') return validateSection(schema.sections[step.index].fields);
    if (step.kind === 'options') {
      if (!optionId) {
        setFormError('Please choose a pass.');
        return false;
      }
      return true;
    }
    if (!scrolledEnd) {
      setFormError('Please read the waiver to the end.');
      return false;
    }
    const signed = sigType === 'typed' ? typedName.trim().length > 1 : Boolean(sigData);
    if (!signed) {
      setFormError('Please sign the waiver.');
      return false;
    }
    if (!consent) {
      setFormError('Please provide consent to continue.');
      return false;
    }
    return true;
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
      setFormError('Please review the earlier steps.');
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
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(
          res.error === 'closed'
            ? 'Registration for this form is closed.'
            : 'Something went wrong. Please try again.',
        );
      }
    });
  }

  if (done) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 font-display text-2xl uppercase tracking-wide">Thank you!</h2>
        <p className="text-muted-foreground">
          {successMessage ?? 'Your registration was received. We will be in touch shortly.'}
        </p>
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
          Step {stepIdx + 1} of {steps.length}
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        {step.kind === 'section' ? (
          <SectionStep
            section={schema.sections[step.index]}
            values={values}
            fieldErrors={fieldErrors}
            register={register}
            setValue={setValue}
          />
        ) : step.kind === 'options' ? (
          <fieldset className="space-y-3">
            <legend className="font-display text-xl uppercase tracking-wide">Choose your pass</legend>
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
                  onChange={() => setOptionId(opt.id)}
                />
                <span className="flex-1">
                  <span className="flex justify-between font-medium">
                    <span>{opt.name}</span>
                    <span>{formatPrice(opt.price_cents)}</span>
                  </span>
                  {opt.description ? (
                    <span className="block text-sm text-muted-foreground">{opt.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : waiver ? (
          <div className="space-y-4">
            <h2 className="font-display text-xl uppercase tracking-wide">{waiver.name}</h2>
            <div
              className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-input p-3 text-sm"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledEnd(true);
              }}
            >
              {waiver.body}
            </div>
            {!scrolledEnd ? (
              <p className="text-xs text-muted-foreground">Scroll to the end to sign.</p>
            ) : null}

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={sigType === 'drawn'}
                  onChange={() => setSigType('drawn')}
                />
                Draw signature
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={sigType === 'typed'}
                  onChange={() => setSigType('typed')}
                />
                Type name
              </label>
            </div>

            {sigType === 'drawn' ? (
              <SignaturePad onChange={setSigData} />
            ) : (
              <Input
                placeholder="Type your full name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
              />
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I am the parent/legal guardian, I have read and agree to this waiver, and I consent to
              signing electronically.
            </label>
          </div>
        ) : null}
      </Card>

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0 || pending}
        >
          Back
        </Button>
        <Button type="submit" disabled={pending}>
          {isLast ? (pending ? 'Submitting…' : 'Submit registration') : 'Next'}
        </Button>
      </div>
    </form>
  );
}
