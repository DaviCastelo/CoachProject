/*
 * Listas de valores do programa.
 *
 * Vivem fora de `actions.ts` por imposição do Next: um arquivo marcado com
 * `'use server'` só pode exportar função async. Exportar um array de lá
 * derruba a rota inteira com "A use server file can only export async
 * functions, found object", e o erro não aparece no typecheck, só ao abrir
 * a página.
 */

export const PROGRAM_TYPES = [
  'camp',
  'small_group',
  'private_1on1',
  'clinic',
  'season',
  'package',
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const PROGRAM_STATUSES = ['draft', 'published', 'closed', 'archived'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export function isProgramType(v: string): v is ProgramType {
  return (PROGRAM_TYPES as readonly string[]).includes(v);
}

export function isProgramStatus(v: string): v is ProgramStatus {
  return (PROGRAM_STATUSES as readonly string[]).includes(v);
}
