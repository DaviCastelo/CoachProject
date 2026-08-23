import { isFieldVisible } from './conditional';
import { PRESENTATIONAL_TYPES, type FormSchema } from './schema';

const PNG_DATA_URL_PREFIX = 'data:image/png';

export type ValidationError = { fieldId: string; message: string };
export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Valida os dados de uma submissão contra o schema do formulário, respeitando a
 * lógica condicional (`showIf`): campos ocultos não são exigidos nem validados.
 * Função pura — não toca em banco nem HTTP.
 */
export function validateSubmission(
  schema: FormSchema,
  data: Record<string, unknown>,
  context: Record<string, unknown> = data,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (PRESENTATIONAL_TYPES.includes(field.type)) continue;
      if (!isFieldVisible(field, context)) continue;

      const value = data[field.id];
      const empty = isEmpty(value);

      if (field.required && empty) {
        errors.push({ fieldId: field.id, message: 'required' });
        continue;
      }
      if (empty) continue;

      if ((field.type === 'dob' || field.type === 'date') && field.validation) {
        const parsed = new Date(String(value));
        if (!Number.isNaN(parsed.getTime())) {
          const year = parsed.getFullYear();
          const { minYear, maxYear } = field.validation;
          if (minYear !== undefined && year < minYear) {
            errors.push({ fieldId: field.id, message: `minYear:${minYear}` });
          }
          if (maxYear !== undefined && year > maxYear) {
            errors.push({ fieldId: field.id, message: `maxYear:${maxYear}` });
          }
        }
      }

      if ((field.type === 'select' || field.type === 'radio') && field.options) {
        if (!field.options.includes(String(value))) {
          errors.push({ fieldId: field.id, message: 'invalid_option' });
        }
      }

      if (field.type === 'multiselect' && field.options && Array.isArray(value)) {
        const invalid = value.some((v) => !field.options!.includes(String(v)));
        if (invalid) errors.push({ fieldId: field.id, message: 'invalid_option' });
      }

      if (field.type === 'email' && !EMAIL_RE.test(String(value))) {
        errors.push({ fieldId: field.id, message: 'invalid_email' });
      }

      if (field.type === 'signature') {
        const raw = String(value).trim();
        if (raw && !raw.startsWith(PNG_DATA_URL_PREFIX) && raw.length <= 1) {
          errors.push({ fieldId: field.id, message: 'invalid_signature' });
        }
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
