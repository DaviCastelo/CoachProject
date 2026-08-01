import { collectableFields, type FormSchema } from './schema';

/** Entidades do domínio que um campo pode alimentar via `mapsTo`. */
export const MAPPABLE_ENTITIES = [
  'athlete',
  'guardian',
  'household',
  'program',
] as const;
export type MappableEntity = (typeof MAPPABLE_ENTITIES)[number];

export type MappedEntities = Record<MappableEntity, Record<string, unknown>> & {
  /** Campos sem `mapsTo` (ou com destino desconhecido) — ficam no JSON da submissão. */
  extra: Record<string, unknown>;
};

function emptyResult(): MappedEntities {
  return { athlete: {}, guardian: {}, household: {}, program: {}, extra: {} };
}

function isMappableEntity(value: string): value is MappableEntity {
  return (MAPPABLE_ENTITIES as readonly string[]).includes(value);
}

/**
 * Distribui os valores de uma submissão nas entidades do domínio a partir do
 * `mapsTo` de cada campo (ex.: `"athlete.first_name"`). Valores sem `mapsTo`
 * mapeável vão para `extra`. Não persiste nada — é função pura.
 */
export function mapSubmissionToEntities(
  schema: FormSchema,
  data: Record<string, unknown>,
): MappedEntities {
  const result = emptyResult();

  for (const field of collectableFields(schema)) {
    const value = data[field.id];
    if (value === undefined) continue;

    if (field.mapsTo) {
      const dot = field.mapsTo.indexOf('.');
      const entity = dot === -1 ? '' : field.mapsTo.slice(0, dot);
      const column = dot === -1 ? '' : field.mapsTo.slice(dot + 1);
      if (column && isMappableEntity(entity)) {
        result[entity][column] = value;
        continue;
      }
    }
    result.extra[field.id] = value;
  }

  return result;
}
