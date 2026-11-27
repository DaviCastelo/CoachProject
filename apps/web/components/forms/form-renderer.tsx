'use client';

import { useMemo } from 'react';
import { useForm, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { isFieldVisible, type FormSchema, type FormField } from '@ca-tempo/domain';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChoiceSelect } from '@/components/ui/choice-select';
import { DateSelect } from '@/components/ui/date-select';
import { SignatureFieldInput } from '@/components/forms/signature-field-input';
import { choiceCard, choiceInput } from '@/components/forms/choice-styles';

type Values = Record<string, unknown>;

function defaultValueFor(field: FormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

function getInputType(field: FormField): 'email' | 'tel' | 'text' {
  if (field.type === 'email') return 'email';
  if (field.type === 'phone') return 'tel';
  return 'text';
}

/*
 * Faixa de anos da lista de data. Nascimento usa a validação do campo
 * (2013 a 2019 no Christmas Camp) e, sem ela, os últimos 100 anos. Data comum
 * vai um pouco para o futuro, para caber "data de início" e afins.
 */
function yearRange(field: FormField): { min: number; max: number } {
  const now = new Date().getFullYear();
  const isDob = field.type === 'dob';
  return {
    min: field.validation?.minYear ?? now - 100,
    max: field.validation?.maxYear ?? (isDob ? now : now + 5),
  };
}

function useErrorText() {
  const t = useTranslations('register.errors');
  return (message: string): string => {
    if (message === 'required') return t('required');
    if (message === 'invalid_email') return t('invalid_email');
    if (message === 'invalid_option') return t('invalid_option');
    if (message.startsWith('minYear:')) return t('minYear', { year: message.split(':')[1] });
    if (message.startsWith('maxYear:')) return t('maxYear', { year: message.split(':')[1] });
    if (message === 'invalid_signature') return t('invalid_signature');
    return t('invalid');
  };
}

export type FormFieldProps = Readonly<{
  field: FormField;
  error?: string;
  register: UseFormRegister<Values>;
  value: unknown;
  setValue: UseFormSetValue<Values>;
}>;

type FieldControlProps = Readonly<{
  field: FormField;
  register: UseFormRegister<Values>;
  value: unknown;
  setValue: UseFormSetValue<Values>;
  checkboxLabel: string;
  selectPlaceholder: string;
  selectNone: string;
  invalid: boolean;
  describedBy?: string;
}>;

function FieldControl({
  field,
  register,
  value,
  setValue,
  checkboxLabel,
  selectPlaceholder,
  selectNone,
  invalid,
  describedBy,
}: FieldControlProps) {
  const set = (next: unknown) =>
    setValue(field.id, next, { shouldDirty: true, shouldValidate: true });

  if (field.type === 'textarea') {
    return (
      <textarea
        id={field.id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground hover:border-accent-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-danger"
        {...register(field.id)}
      />
    );
  }

  if (field.type === 'select' || field.type === 'pass_selector') {
    const options = (field.options ?? []).map((opt) => ({ value: opt, label: opt }));
    return (
      <ChoiceSelect
        id={field.id}
        value={typeof value === 'string' ? value : ''}
        onValueChange={set}
        // Campo opcional precisa de um jeito de voltar a "sem resposta".
        options={field.required ? options : [{ value: '', label: selectNone }, ...options]}
        placeholder={selectPlaceholder}
        invalid={invalid}
        aria-describedby={describedBy}
      />
    );
  }

  if (field.type === 'date' || field.type === 'dob') {
    const { min, max } = yearRange(field);
    return (
      <DateSelect
        id={field.id}
        value={typeof value === 'string' ? value : ''}
        onChange={set}
        minYear={min}
        maxYear={max}
        yearOrder="desc"
        clearable={!field.required}
        invalid={invalid}
        aria-labelledby={`${field.id}-label`}
        aria-describedby={describedBy}
      />
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className={choiceCard}>
            <input type="radio" value={opt} className={choiceInput} {...register(field.id)} />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className={choiceCard}>
        <input type="checkbox" className={choiceInput} {...register(field.id)} />
        <span className="text-sm">{field.placeholder ?? checkboxLabel}</span>
      </label>
    );
  }

  if (field.type === 'multiselect') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className={choiceCard}>
            <input
              type="checkbox"
              className={choiceInput}
              checked={arr.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked ? [...arr, opt] : arr.filter((v) => v !== opt);
                setValue(field.id, next);
              }}
            />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'signature') {
    return (
      <SignatureFieldInput
        fieldId={field.id}
        value={value}
        onChange={(next) => setValue(field.id, next, { shouldDirty: true, shouldValidate: true })}
      />
    );
  }

  return (
    <Input
      id={field.id}
      type={getInputType(field)}
      placeholder={field.placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...register(field.id)}
    />
  );
}

export function FormFieldInput({ field, error, register, value, setValue }: FormFieldProps) {
  const t = useTranslations('register');
  const errorText = useErrorText();

  if (field.type === 'header') {
    return <h3 className="pt-2 font-display text-lg uppercase tracking-wide">{field.label}</h3>;
  }
  if (field.type === 'info') {
    return <p className="text-sm text-muted-foreground">{field.label}</p>;
  }

  const helpId = `${field.id}-help`;
  const errorId = `${field.id}-error`;
  const describedBy =
    [field.helpText ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      {field.label ? (
        <Label id={`${field.id}-label`} htmlFor={field.id}>
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
        </Label>
      ) : null}

      <FieldControl
        field={field}
        register={register}
        value={value}
        setValue={setValue}
        checkboxLabel={t('checkboxYes')}
        selectPlaceholder={t('selectPlaceholder')}
        selectNone={t('selectNone')}
        invalid={Boolean(error)}
        describedBy={describedBy}
      />

      {field.helpText ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {errorText(error)}
        </p>
      ) : null}
    </div>
  );
}

export type SectionStepProps = Readonly<{
  section: FormSchema['sections'][number];
  values: Values;
  fieldErrors: Record<string, string>;
  register: UseFormRegister<Values>;
  setValue: UseFormSetValue<Values>;
}>;

export function SectionStep({
  section,
  values,
  fieldErrors,
  register,
  setValue,
}: SectionStepProps) {
  return (
    <>
      {section.title ? (
        <h2 className="font-display text-xl uppercase tracking-wide">{section.title}</h2>
      ) : null}
      {section.description ? (
        <p className="text-sm text-muted-foreground">{section.description}</p>
      ) : null}
      {section.fields.map((field) => {
        if (!isFieldVisible(field, values)) return null;
        return (
          <FormFieldInput
            key={field.id}
            field={field}
            error={fieldErrors[field.id]}
            register={register}
            value={values[field.id]}
            setValue={setValue}
          />
        );
      })}
    </>
  );
}

type FormRendererProps = Readonly<{
  schema: FormSchema;
  preview?: boolean;
  fieldErrors?: Record<string, string>;
}>;

/** Renders form sections. In preview mode, shows all sections at once without submit. */
export function FormRenderer({ schema, preview = false, fieldErrors = {} }: FormRendererProps) {
  const { register, watch, setValue } = useForm<Values>({
    defaultValues: useMemo(() => {
      const dv: Values = {};
      for (const section of schema.sections) {
        for (const field of section.fields) dv[field.id] = defaultValueFor(field);
      }
      return dv;
    }, [schema]),
  });

  const values = watch();

  if (preview) {
    return (
      <div className="space-y-8">
        {schema.sections.map((section) => (
          <div key={section.id} className="space-y-4">
            <SectionStep
              section={section}
              values={values}
              fieldErrors={fieldErrors}
              register={register}
              setValue={setValue}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <SectionStep
      section={schema.sections[0]}
      values={values}
      fieldErrors={fieldErrors}
      register={register}
      setValue={setValue}
    />
  );
}
