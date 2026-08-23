'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Link2, Settings2 } from 'lucide-react';
import {
  MAPPABLE_TARGETS,
  PRESENTATIONAL_TYPES,
  type FormField,
  type FormSchema,
} from '@ca-tempo/domain';
import { FIELD_ICON } from '@/lib/forms/catalog';
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
  const Icon = FIELD_ICON[field.type];
  const isPresentational = PRESENTATIONAL_TYPES.includes(field.type);

  const showIfCandidates = schema.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.id !== field.id && !PRESENTATIONAL_TYPES.includes(f.type));

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

  const hasAdvanced = !isPresentational;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: tipo do campo, amigável */}
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
        <Icon className="h-4 w-4 text-accent-500" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(`fieldTypes.${field.type}.label`)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t(`fieldTypes.${field.type}.description`)}
          </p>
        </div>
      </div>

      {/* Rótulo */}
      <div className="space-y-1.5">
        <Label htmlFor="field-label">{t('fieldLabel')}</Label>
        <Input
          id="field-label"
          value={field.label ?? ''}
          placeholder={t('fieldLabelPlaceholder')}
          onChange={(e) => patch({ label: e.target.value || undefined })}
        />
      </div>

      {/* Obrigatório */}
      {!isPresentational ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent-500"
            checked={field.required ?? false}
            onChange={(e) => patch({ required: e.target.checked })}
          />
          {t('fieldRequired')}
        </label>
      ) : null}

      {/* Opções (escolhas) */}
      {OPTION_TYPES.has(field.type) ? (
        <div className="space-y-2">
          <Label>{t('fieldOptions')}</Label>
          {(field.options ?? []).map((opt, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={opt}
                placeholder={t('optionPlaceholder', { n: idx + 1 })}
                onChange={(e) => {
                  const options = [...(field.options ?? [])];
                  options[idx] = e.target.value;
                  patch({ options });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('removeOption')}
                onClick={() => patch({ options: (field.options ?? []).filter((_, i) => i !== idx) })}
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

      {/* Este campo preenche… (mapsTo humanizado) */}
      {!isPresentational ? (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            {t('mapsToLabel')}
          </Label>
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
                  <SelectLabel>{t(`mapGroups.${entity}`)}</SelectLabel>
                  {targets.map((target) => (
                    <SelectItem key={target} value={target}>
                      {t(`mapTargets.${target}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('mapsToHint')}</p>
        </div>
      ) : null}

      {/* Opções avançadas (recolhido) */}
      {hasAdvanced ? (
        <details className="group rounded-md border border-input">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <Settings2 className="h-4 w-4" />
            {t('advanced')}
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-4 border-t border-input p-3">
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

            {DATE_TYPES.has(field.type) || TEXT_TYPES.has(field.type) ? (
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
                          updateValidation('minYear', e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('maxYear')}</Label>
                      <Input
                        type="number"
                        value={field.validation?.maxYear ?? ''}
                        onChange={(e) =>
                          updateValidation('maxYear', e.target.value ? Number(e.target.value) : undefined)
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
                            updateValidation('minLength', e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('maxLength')}</Label>
                        <Input
                          type="number"
                          value={field.validation?.maxLength ?? ''}
                          onChange={(e) =>
                            updateValidation('maxLength', e.target.value ? Number(e.target.value) : undefined)
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

            {/* Condicional: mostrar se */}
            <div className="space-y-2">
              <Label>{t('showIf')}</Label>
              <p className="text-xs text-muted-foreground">{t('showIfHint')}</p>
              <Select
                value={field.showIf?.field ?? '__none__'}
                onValueChange={(v) =>
                  v === '__none__'
                    ? patch({ showIf: undefined })
                    : patch({ showIf: { field: v, equals: field.showIf?.equals ?? '' } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('showIfField')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('showIfAlways')}</SelectItem>
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
                      patch({ showIf: { field: field.showIf!.field, equals: e.target.value } })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
