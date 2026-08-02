import {
  fieldTypeSchema,
  PRESENTATIONAL_TYPES,
  type FieldType,
  type FormField,
  type FormSchema,
  type FormSection,
} from './schema';

/** All supported field types (from Zod enum). */
export const FIELD_TYPES = fieldTypeSchema.options;

/** Curated `mapsTo` targets grouped by entity. */
export const MAPPABLE_TARGETS: Readonly<Record<string, readonly string[]>> = {
  athlete: [
    'athlete.first_name',
    'athlete.last_name',
    'athlete.date_of_birth',
    'athlete.gender',
    'athlete.current_club',
    'athlete.playing_level',
    'athlete.positions',
    'athlete.dominant_foot',
    'athlete.jersey_size',
    'athlete.school',
    'athlete.graduation_year',
    'athlete.short_term_goals',
    'athlete.long_term_goals',
    'athlete.allergies',
    'athlete.medical_notes',
  ],
  guardian: [
    'guardian.first_name',
    'guardian.last_name',
    'guardian.email',
    'guardian.phone',
    'guardian.relationship',
  ],
  household: ['household.name'],
  program: ['program.type'],
} as const;

export type FormVersionInfo = {
  version: number;
  published_at: string | null;
  schema: unknown;
};

export type FormMeta = {
  status: string;
};

export type VersionStatus =
  | { kind: 'draft-only'; version: number }
  | { kind: 'published'; version: number }
  | { kind: 'unpublished-changes'; publishedVersion: number; draftVersion: number };

/** Normalize a name into a URL-safe slug. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Ensure slug is unique by appending -2, -3, etc. */
export function ensureUniqueSlug(slug: string, existing: readonly string[]): string {
  if (!existing.includes(slug)) return slug;
  let n = 2;
  while (existing.includes(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/** Generate a stable ID from an optional label, avoiding collisions within `existingIds`. */
export function generateId(label?: string, existingIds: readonly string[] = []): string {
  const base = label ? slugify(label).replace(/-/g, '_') : 'item';
  const candidate = base || 'item';
  if (!existingIds.includes(candidate)) return candidate;
  let n = 2;
  while (existingIds.includes(`${candidate}_${n}`)) n++;
  return `${candidate}_${n}`;
}

export function createEmptySchema(): FormSchema {
  return { sections: [] };
}

function allFieldIds(schema: FormSchema): string[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => f.id));
}

function allSectionIds(schema: FormSchema): string[] {
  return schema.sections.map((s) => s.id);
}

export function addSection(
  schema: FormSchema,
  section?: Partial<Pick<FormSection, 'id' | 'title' | 'description'>>,
): FormSchema {
  const id = section?.id ?? generateId(section?.title ?? 'section', allSectionIds(schema));
  const newSection: FormSection = {
    id,
    title: section?.title,
    description: section?.description,
    fields: [],
  };
  return { ...schema, sections: [...schema.sections, newSection] };
}

export function removeSection(schema: FormSchema, sectionId: string): FormSchema {
  return {
    ...schema,
    sections: schema.sections.filter((s) => s.id !== sectionId),
  };
}

export function updateSection(
  schema: FormSchema,
  sectionId: string,
  patch: Partial<Pick<FormSection, 'title' | 'description'>>,
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
  };
}

export function addField(
  schema: FormSchema,
  sectionId: string,
  field?: Partial<FormField> & { type: FieldType },
): FormSchema {
  const type = field?.type ?? 'text';
  const id = field?.id ?? generateId(field?.label ?? type, allFieldIds(schema));
  const newField: FormField = {
    id,
    type,
    label: field?.label,
    placeholder: field?.placeholder,
    helpText: field?.helpText,
    required: field?.required ?? false,
    options: field?.options,
    mapsTo: field?.mapsTo,
    validation: field?.validation,
    showIf: field?.showIf,
  };
  return {
    ...schema,
    sections: schema.sections.map((s) =>
      s.id === sectionId ? { ...s, fields: [...s.fields, newField] } : s,
    ),
  };
}

export function removeField(schema: FormSchema, sectionId: string, fieldId: string): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) =>
      s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s,
    ),
  };
}

export function updateField(
  schema: FormSchema,
  sectionId: string,
  fieldId: string,
  patch: Partial<Omit<FormField, 'id'>>,
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) =>
      s.id === sectionId
        ? {
            ...s,
            fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
          }
        : s,
    ),
  };
}

function findSectionIndex(schema: FormSchema, sectionId: string): number {
  return schema.sections.findIndex((s) => s.id === sectionId);
}

function findFieldLocation(
  schema: FormSchema,
  fieldId: string,
): { sectionId: string; index: number } | null {
  for (const section of schema.sections) {
    const index = section.fields.findIndex((f) => f.id === fieldId);
    if (index !== -1) return { sectionId: section.id, index };
  }
  return null;
}

/** Reorder sections by moving activeId to the position of overId. */
export function reorderSections(schema: FormSchema, activeId: string, overId: string): FormSchema {
  const from = findSectionIndex(schema, activeId);
  const to = findSectionIndex(schema, overId);
  if (from === -1 || to === -1 || from === to) return schema;
  const sections = [...schema.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { ...schema, sections };
}

/** Reorder fields within a section by moving activeId to the position of overId. */
export function reorderFieldInSection(
  schema: FormSchema,
  sectionId: string,
  activeId: string,
  overId: string,
): FormSchema {
  return moveField(schema, activeId, sectionId, sectionId, overId);
}

/**
 * Move a field to a target section at a specific index (or before overId field).
 * If toIndex is a string it is treated as overFieldId.
 */
export function moveField(
  schema: FormSchema,
  fieldId: string,
  fromSectionId: string,
  toSectionId: string,
  toIndexOrOverId: number | string,
): FormSchema {
  const fromSection = schema.sections.find((s) => s.id === fromSectionId);
  if (!fromSection) return schema;

  const fieldIdx = fromSection.fields.findIndex((f) => f.id === fieldId);
  if (fieldIdx === -1) return schema;

  const field = fromSection.fields[fieldIdx];
  const sections = schema.sections.map((s) => ({ ...s, fields: [...s.fields] }));

  const from = sections.find((s) => s.id === fromSectionId);
  const to = sections.find((s) => s.id === toSectionId);
  if (!from || !to) return schema;

  from.fields.splice(fieldIdx, 1);

  let insertAt: number;
  if (typeof toIndexOrOverId === 'number') {
    insertAt = Math.min(toIndexOrOverId, to.fields.length);
  } else {
    const overIdx = to.fields.findIndex((f) => f.id === toIndexOrOverId);
    insertAt = overIdx === -1 ? to.fields.length : overIdx;
    // When moving within same section and dragging down, adjust index
    if (fromSectionId === toSectionId && fieldIdx < insertAt) insertAt--;
  }

  to.fields.splice(Math.max(0, insertAt), 0, field);
  return { ...schema, sections };
}

/** Fields that can be referenced in showIf (excludes presentational types and self). */
export function collectShowIfCandidates(
  schema: FormSchema,
  excludeFieldId?: string,
): FormField[] {
  return schema.sections
    .flatMap((s) => s.fields)
    .filter(
      (f) =>
        !PRESENTATIONAL_TYPES.includes(f.type) &&
        f.id !== excludeFieldId,
    );
}

export function hasUnpublishedDraft(latestVersion: FormVersionInfo): boolean {
  return latestVersion.published_at === null;
}

/** Derive version status badges from form metadata and version list. */
export function getVersionStatus(
  form: FormMeta,
  versions: readonly FormVersionInfo[],
): VersionStatus {
  if (versions.length === 0) return { kind: 'draft-only', version: 1 };

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0];
  const latestPublished = sorted.find((v) => v.published_at !== null);

  if (!latestPublished) {
    return { kind: 'draft-only', version: latest.version };
  }

  if (latest.published_at === null) {
    return {
      kind: 'unpublished-changes',
      publishedVersion: latestPublished.version,
      draftVersion: latest.version,
    };
  }

  return { kind: 'published', version: latestPublished.version };
}
