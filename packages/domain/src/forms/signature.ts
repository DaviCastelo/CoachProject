import type { FormSchema } from './schema';

export type ExtractedSignature = {
  signatureType: 'drawn' | 'typed';
  signatureData: string;
};

const PNG_DATA_URL_PREFIX = 'data:image/png';

export function isDrawnSignatureValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PNG_DATA_URL_PREFIX);
}

/** Verifica se o schema contém ao menos um campo coletável de assinatura. */
export function hasSignatureField(schema: FormSchema): boolean {
  return schema.sections.some((section) => section.fields.some((field) => field.type === 'signature'));
}

/**
 * Extrai a primeira assinatura válida dos campos `signature` do schema.
 * Valor drawn: data URL PNG. Valor typed: nome não-vazio.
 */
export function extractSignatureFromSchema(
  schema: FormSchema,
  data: Record<string, unknown>,
): ExtractedSignature | null {
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type !== 'signature') continue;
      const value = data[field.id];
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (isDrawnSignatureValue(trimmed)) {
        return { signatureType: 'drawn', signatureData: trimmed };
      }
      return { signatureType: 'typed', signatureData: trimmed };
    }
  }
  return null;
}
