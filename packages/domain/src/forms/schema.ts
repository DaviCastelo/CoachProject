import { z } from 'zod';

/**
 * Definição do schema JSON dos formulários (substitui o JotForm).
 * Cada campo pode ter `mapsTo` (coluna do domínio onde desemboca) e `showIf`
 * (lógica condicional). Ver docs/03 › Formulários e docs/04 › M1.
 */

export const fieldTypeSchema = z.enum([
  'text',
  'email',
  'phone',
  'date',
  'dob',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'textarea',
  'upload',
  'signature',
  'header',
  'info',
  'pass_selector',
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/** Tipos que só apresentam conteúdo — não coletam valor nem validam. */
export const PRESENTATIONAL_TYPES: readonly FieldType[] = ['header', 'info'];

export const fieldValidationSchema = z
  .object({
    minYear: z.number().int(),
    maxYear: z.number().int(),
    min: z.number(),
    max: z.number(),
    minLength: z.number().int(),
    maxLength: z.number().int(),
    pattern: z.string(),
  })
  .partial();
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

export const showIfSchema = z.object({
  field: z.string(),
  equals: z.union([z.string(), z.number(), z.boolean()]),
});
export type ShowIf = z.infer<typeof showIfSchema>;

export const formFieldSchema = z.object({
  id: z.string().min(1),
  type: fieldTypeSchema,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  mapsTo: z.string().optional(),
  validation: fieldValidationSchema.optional(),
  showIf: showIfSchema.optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
});
export type FormSection = z.infer<typeof formSectionSchema>;

export const discountSchema = z.object({
  type: z.string(),
  amountCents: z.number().int().optional(),
  percentOff: z.number().optional(),
  per: z.string().optional(),
});
export type Discount = z.infer<typeof discountSchema>;

export const formSchema = z.object({
  sections: z.array(formSectionSchema),
  pricing: z
    .object({
      source: z.string().optional(),
      discounts: z.array(discountSchema).optional(),
    })
    .optional(),
});
export type FormSchema = z.infer<typeof formSchema>;

/** Valida e normaliza um schema de formulário (lança ZodError se inválido). */
export function parseFormSchema(input: unknown): FormSchema {
  return formSchema.parse(input);
}

/** Todos os campos "coletáveis" (ignora header/info), achatando as seções. */
export function collectableFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((s) =>
    s.fields.filter((f) => !PRESENTATIONAL_TYPES.includes(f.type)),
  );
}
