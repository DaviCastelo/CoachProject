'use client';

import { useMemo } from 'react';
import { useForm, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { isFieldVisible, type FormSchema, type FormField } from '@ca-tempo/domain';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureFieldInput } from '@/components/forms/signature-field-input';

type Values = Record<string, unknown>;

function defaultValueFor(field: FormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

function getInputType(field: FormField): 'email' | 'tel' | 'date' | 'text' {
  if (field.type === 'email') return 'email';
  if (field.type === 'phone') return 'tel';
  if (field.type === 'date' || field.type === 'dob') return 'date';
  return 'text';
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
}>;

function FieldControl({ field, register, value, setValue, checkboxLabel }: FieldControlProps) {
  if (field.type === 'textarea') {
    return (
      <textarea
        id={field.id}
        className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        {...register(field.id)}
      />
    );
  }

  if (field.type === 'select' || field.type === 'pass_selector') {
    return (
      <select
        id={field.id}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        {...register(field.id)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="space-y-1">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input type="radio" value={opt} {...register(field.id)} />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register(field.id)} />
        {field.placeholder ?? checkboxLabel}
      </label>
    );
  }

  if (field.type === 'multiselect') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={arr.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked ? [...arr, opt] : arr.filter((v) => v !== opt);
                setValue(field.id, next);
              }}
            />
            {opt}
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

  return (
    <div className="space-y-1.5">
      {field.label ? (
        <Label htmlFor={field.id}>
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
      />

      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
      {error ? <p className="text-xs text-danger">{errorText(error)}</p> : null}
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
