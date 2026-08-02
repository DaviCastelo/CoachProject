'use client';

import { useTranslations } from 'next-intl';
import {
  MAPPABLE_TARGETS,
  type FormField,
  type FormSchema,
} from '@ca-tempo/domain';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OPTION_TYPES = new Set(['select', 'multiselect', 'radio']);
const DATE_TYPES = new Set(['date', 'dob']);
const TEXT_TYPES = new Set(['text', 'textarea', 'email', 'phone']);

type Props = {
  field: FormField;
  sectionId: string;
  schema: FormSchema;
  onChange: (sectionId: string, fieldId: string, patch: Partial<FormField>) => void;
};

export function FieldEditor({ field, sectionId, schema, onChange }: Props) {
  const t = useTranslations('forms');

  const showIfCandidates = schema.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.id !== field.id && f.type !== 'header' && f.type !== 'info');

  function patch(p: Partial<FormField>) {
    onChange(sectionId, field.id, p);
  }

  function updateValidation(key: string, value: number | string | undefined) {
    const validation = { ...field.validation };
    if (value === undefined || value === '') {
      delete validation[key as keyof typeof validation];
    } else {
      (validation as Record<string, number | string>)[key] = value;
    }
    patch({ validation: Object.keys(validation).length > 0 ? validation : undefined });
  }

  return (
    <div className="space-y-4 rounded-md border border-input p-4">
      <div className="space-y-1.5">
        <Label>{t('fieldType')}</Label>
        <p className="text-sm font-medium">{field.type}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="field-label">{t('fieldLabel')}</Label>
        <Input
          id="field-label"
          value={field.label ?? ''}
          onChange={(e) => patch({ label: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="field-placeholder">{t('fieldPlaceholder')}</Label>
        <Input
          id="field-placeholder"
          value={field.placeholder ?? ''}
          onChange={(e) => patch({ placeholder: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="field-help">{t('fieldHelpText')}</Label>
        <Input
          id="field-help"
          value={field.helpText ?? ''}
          onChange={(e) => patch({ helpText: e.target.value || undefined })}
        />
      </div>

      {field.type !== 'header' && field.type !== 'info' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => patch({ required: e.target.checked })}
          />
          {t('fieldRequired')}
        </label>
      ) : null}

      {OPTION_TYPES.has(field.type) ? (
        <div className="space-y-2">
          <Label>{t('fieldOptions')}</Label>
          {(field.options ?? []).map((opt, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const options = [...(field.options ?? [])];
                  options[idx] = e.target.value;
                  patch({ options });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const options = (field.options ?? []).filter((_, i) => i !== idx);
                  patch({ options });
                }}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ options: [...(field.options ?? []), ''] })}
          >
            {t('addOption')}
          </Button>
        </div>
      ) : null}

      {field.type !== 'header' && field.type !== 'info' ? (
        <div className="space-y-1.5">
          <Label>{t('mapsTo')}</Label>
          <Select
            value={field.mapsTo ?? '__none__'}
            onValueChange={(v) => patch({ mapsTo: v === '__none__' ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('mapsToNone')}</SelectItem>
              {Object.entries(MAPPABLE_TARGETS).map(([entity, targets]) => (
                <SelectGroup key={entity}>
                  <SelectLabel className="capitalize">{entity}</SelectLabel>
                  {targets.map((target) => (
                    <SelectItem key={target} value={target}>
                      {target}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {(DATE_TYPES.has(field.type) || TEXT_TYPES.has(field.type)) && field.type !== 'header' ? (
        <div className="space-y-2">
          <Label>{t('validation')}</Label>
          {DATE_TYPES.has(field.type) ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('minYear')}</Label>
                <Input
                  type="number"
                  value={field.validation?.minYear ?? ''}
                  onChange={(e) =>
                    updateValidation(
                      'minYear',
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('maxYear')}</Label>
                <Input
                  type="number"
                  value={field.validation?.maxYear ?? ''}
                  onChange={(e) =>
                    updateValidation(
                      'maxYear',
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
          {TEXT_TYPES.has(field.type) ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t('minLength')}</Label>
                  <Input
                    type="number"
                    value={field.validation?.minLength ?? ''}
                    onChange={(e) =>
                      updateValidation(
                        'minLength',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('maxLength')}</Label>
                  <Input
                    type="number"
                    value={field.validation?.maxLength ?? ''}
                    onChange={(e) =>
                      updateValidation(
                        'maxLength',
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
              </div>
              {field.type === 'text' ? (
                <div className="space-y-1">
                  <Label className="text-xs">{t('pattern')}</Label>
                  <Input
                    value={field.validation?.pattern ?? ''}
                    onChange={(e) => updateValidation('pattern', e.target.value || undefined)}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {field.type !== 'header' && field.type !== 'info' ? (
        <div className="space-y-2">
          <Label>{t('showIf')}</Label>
          <Select
            value={field.showIf?.field ?? '__none__'}
            onValueChange={(v) => {
              if (v === '__none__') {
                patch({ showIf: undefined });
              } else {
                patch({
                  showIf: { field: v, equals: field.showIf?.equals ?? '' },
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('showIfField')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {showIfCandidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label ?? c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.showIf ? (
            <div className="space-y-1">
              <Label className="text-xs">{t('showIfValue')}</Label>
              <Input
                value={String(field.showIf.equals)}
                onChange={(e) =>
                  patch({
                    showIf: { field: field.showIf!.field, equals: e.target.value },
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
