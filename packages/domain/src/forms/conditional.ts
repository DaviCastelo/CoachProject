import type { FormField } from './schema';

/**
 * Avalia a lógica condicional `showIf`. O campo é visível quando não há `showIf`
 * ou quando o valor referenciado no contexto é igual ao esperado.
 *
 * `context` costuma ser o merge dos dados da submissão com valores derivados
 * (ex.: `program.type`), permitindo condições como `{ field: "program.type", equals: "camp" }`.
 */
export function isFieldVisible(
  field: FormField,
  context: Record<string, unknown>,
): boolean {
  if (!field.showIf) return true;
  return context[field.showIf.field] === field.showIf.equals;
}
