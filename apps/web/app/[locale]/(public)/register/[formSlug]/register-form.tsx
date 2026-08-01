'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import {
  isFieldVisible,
  validateSubmission,
  type FormSchema,
  type FormField,
} from '@ca-tempo/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { submitRegistration } from './actions';

type Props = {
  formVersionId: string;
  schema: FormSchema;
  successMessage: string | null;
};

type Values = Record<string, unknown>;

function defaultValueFor(field: FormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

export function RegisterForm({ formVersionId, schema, successMessage }: Props) {
  const { register, watch, getValues, setValue } = useForm<Values>({
    defaultValues: useMemo(() => {
      const dv: Values = {};
      for (const section of schema.sections) {
        for (const field of section.fields) dv[field.id] = defaultValueFor(field);
      }
      return dv;
    }, [schema]),
  });

  const [step, setStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const values = watch();
  const sections = schema.sections;
  const section = sections[step];
  const isLast = step === sections.length - 1;

  function visibleFieldIds(fields: FormField[]): string[] {
    return fields.filter((f) => isFieldVisible(f, values)).map((f) => f.id);
  }

  function runValidation(scopeIds?: string[]): boolean {
    const result = validateSubmission(schema, getValues());
    const errors = result.ok ? [] : result.errors;
    const scoped = scopeIds ? errors.filter((e) => scopeIds.includes(e.fieldId)) : errors;
    const map: Record<string, string> = {};
    for (const e of scoped) map[e.fieldId] = e.message;
    setFieldErrors(map);
    return scoped.length === 0;
  }

  function handleNext() {
    if (runValidation(visibleFieldIds(section.fields))) {
      setStep((s) => Math.min(s + 1, sections.length - 1));
    }
  }

  function handleSubmit() {
    if (!runValidation()) return;
    setFormError(null);
    startTransition(async () => {
      const res = await submitRegistration(formVersionId, getValues());
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
        if (isLast) handleSubmit();
        else handleNext();
      }}
      noValidate
    >
      {sections.length > 1 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Step {step + 1} of {sections.length}
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        {section.title ? (
          <h2 className="font-display text-xl uppercase tracking-wide">{section.title}</h2>
        ) : null}
        {section.description ? (
          <p className="text-sm text-muted-foreground">{section.description}</p>
        ) : null}

        {section.fields.map((field) => {
          if (!isFieldVisible(field, values)) return null;
          return (
            <Field
              key={field.id}
              field={field}
              error={fieldErrors[field.id]}
              register={register}
              value={values[field.id]}
              setValue={setValue}
            />
          );
        })}
      </Card>

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
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

type FieldProps = {
  field: FormField;
  error?: string;
  register: UseFormRegister<Values>;
  value: unknown;
  setValue: UseFormSetValue<Values>;
};

function errorText(message: string): string {
  if (message === 'required') return 'This field is required.';
  if (message === 'invalid_email') return 'Enter a valid email.';
  if (message === 'invalid_option') return 'Choose a valid option.';
  if (message.startsWith('minYear:')) return `Year must be ${message.split(':')[1]} or later.`;
  if (message.startsWith('maxYear:')) return `Year must be ${message.split(':')[1]} or earlier.`;
  return 'Invalid value.';
}

function Field({ field, error, register, value, setValue }: FieldProps) {
  if (field.type === 'header') {
    return <h3 className="pt-2 font-display text-lg uppercase tracking-wide">{field.label}</h3>;
  }
  if (field.type === 'info') {
    return <p className="text-sm text-muted-foreground">{field.label}</p>;
  }

  const inputType =
    field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' || field.type === 'dob' ? 'date' : 'text';

  return (
    <div className="space-y-1.5">
      {field.label ? (
        <Label htmlFor={field.id}>
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
        </Label>
      ) : null}

      {field.type === 'textarea' ? (
        <textarea
          id={field.id}
          className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          {...register(field.id)}
        />
      ) : field.type === 'select' || field.type === 'pass_selector' ? (
        <select
          id={field.id}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          {...register(field.id)}
        >
          <option value="">—</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'radio' ? (
        <div className="space-y-1">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type="radio" value={opt} {...register(field.id)} />
              {opt}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register(field.id)} />
          {field.placeholder ?? 'Yes'}
        </label>
      ) : field.type === 'multiselect' ? (
        <div className="space-y-1">
          {(field.options ?? []).map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arr.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, opt]
                      : arr.filter((v) => v !== opt);
                    setValue(field.id, next);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      ) : (
        <Input id={field.id} type={inputType} placeholder={field.placeholder} {...register(field.id)} />
      )}

      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
      {error ? <p className="text-xs text-danger">{errorText(error)}</p> : null}
    </div>
  );
}
