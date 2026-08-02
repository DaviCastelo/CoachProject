import { describe, it, expect } from 'vitest';
import {
  slugify,
  ensureUniqueSlug,
  generateId,
  createEmptySchema,
  addSection,
  removeSection,
  updateSection,
  addField,
  removeField,
  updateField,
  reorderSections,
  reorderFieldInSection,
  moveField,
  collectShowIfCandidates,
  hasUnpublishedDraft,
  getVersionStatus,
  MAPPABLE_TARGETS,
} from './builder';

describe('slugify', () => {
  it('normalizes names to URL-safe slugs', () => {
    expect(slugify('CA Tempo Summer Camp 2026')).toBe('ca-tempo-summer-camp-2026');
    expect(slugify('  Hello World!  ')).toBe('hello-world');
    expect(slugify('São Paulo')).toBe('sao-paulo');
  });
});

describe('ensureUniqueSlug', () => {
  it('returns slug unchanged when unique', () => {
    expect(ensureUniqueSlug('my-form', ['other'])).toBe('my-form');
  });

  it('appends suffix on conflict', () => {
    expect(ensureUniqueSlug('my-form', ['my-form'])).toBe('my-form-2');
    expect(ensureUniqueSlug('my-form', ['my-form', 'my-form-2'])).toBe('my-form-3');
  });
});

describe('generateId', () => {
  it('generates slug from label', () => {
    expect(generateId('First Name')).toBe('first_name');
  });

  it('avoids collisions', () => {
    expect(generateId('First Name', ['first_name'])).toBe('first_name_2');
  });
});

describe('section CRUD', () => {
  it('adds, updates, and removes sections', () => {
    let schema = createEmptySchema();
    schema = addSection(schema, { title: 'Athlete Info' });
    expect(schema.sections).toHaveLength(1);
    expect(schema.sections[0].title).toBe('Athlete Info');

    const sectionId = schema.sections[0].id;
    schema = updateSection(schema, sectionId, { description: 'Tell us about the athlete' });
    expect(schema.sections[0].description).toBe('Tell us about the athlete');

    schema = removeSection(schema, sectionId);
    expect(schema.sections).toHaveLength(0);
  });
});

describe('field CRUD', () => {
  it('adds, updates, and removes fields', () => {
    let schema = addSection(createEmptySchema(), { id: 's1', title: 'Section' });
    schema = addField(schema, 's1', { type: 'text', label: 'Name' });
    expect(schema.sections[0].fields).toHaveLength(1);

    const fieldId = schema.sections[0].fields[0].id;
    schema = updateField(schema, 's1', fieldId, { required: true, mapsTo: 'athlete.first_name' });
    expect(schema.sections[0].fields[0].required).toBe(true);
    expect(schema.sections[0].fields[0].mapsTo).toBe('athlete.first_name');

    schema = removeField(schema, 's1', fieldId);
    expect(schema.sections[0].fields).toHaveLength(0);
  });
});

describe('reorderSections', () => {
  it('moves sections', () => {
    let schema = createEmptySchema();
    schema = addSection(schema, { id: 'a', title: 'A' });
    schema = addSection(schema, { id: 'b', title: 'B' });
    schema = addSection(schema, { id: 'c', title: 'C' });
    schema = reorderSections(schema, 'c', 'a');
    expect(schema.sections.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('reorderFieldInSection', () => {
  it('reorders fields within a section', () => {
    let schema = addSection(createEmptySchema(), { id: 's1' });
    schema = addField(schema, 's1', { id: 'f1', type: 'text', label: 'A' });
    schema = addField(schema, 's1', { id: 'f2', type: 'text', label: 'B' });
    schema = addField(schema, 's1', { id: 'f3', type: 'text', label: 'C' });
    schema = reorderFieldInSection(schema, 's1', 'f3', 'f1');
    expect(schema.sections[0].fields.map((f) => f.id)).toEqual(['f3', 'f1', 'f2']);
  });
});

describe('moveField between sections', () => {
  it('moves a field to another section', () => {
    let schema = addSection(createEmptySchema(), { id: 's1' });
    schema = addSection(schema, { id: 's2' });
    schema = addField(schema, 's1', { id: 'f1', type: 'text', label: 'Field' });
    schema = moveField(schema, 'f1', 's1', 's2', 0);
    expect(schema.sections[0].fields).toHaveLength(0);
    expect(schema.sections[1].fields).toHaveLength(1);
    expect(schema.sections[1].fields[0].id).toBe('f1');
  });
});

describe('collectShowIfCandidates', () => {
  it('excludes presentational types and self', () => {
    let schema = addSection(createEmptySchema(), { id: 's1' });
    schema = addField(schema, 's1', { id: 'hdr', type: 'header', label: 'Header' });
    schema = addField(schema, 's1', { id: 'name', type: 'text', label: 'Name' });
    schema = addField(schema, 's1', { id: 'email', type: 'email', label: 'Email' });

    const candidates = collectShowIfCandidates(schema, 'name');
    expect(candidates.map((f) => f.id)).toEqual(['email']);
  });
});

describe('version helpers', () => {
  it('detects unpublished draft', () => {
    expect(hasUnpublishedDraft({ version: 2, published_at: null, schema: {} })).toBe(true);
    expect(
      hasUnpublishedDraft({ version: 1, published_at: '2026-01-01', schema: {} }),
    ).toBe(false);
  });

  it('derives version status', () => {
    expect(getVersionStatus({ status: 'draft' }, [])).toEqual({ kind: 'draft-only', version: 1 });

    expect(
      getVersionStatus({ status: 'draft' }, [
        { version: 1, published_at: null, schema: {} },
      ]),
    ).toEqual({ kind: 'draft-only', version: 1 });

    expect(
      getVersionStatus({ status: 'published' }, [
        { version: 1, published_at: '2026-01-01', schema: {} },
      ]),
    ).toEqual({ kind: 'published', version: 1 });

    expect(
      getVersionStatus({ status: 'published' }, [
        { version: 1, published_at: '2026-01-01', schema: {} },
        { version: 2, published_at: null, schema: {} },
      ]),
    ).toEqual({
      kind: 'unpublished-changes',
      publishedVersion: 1,
      draftVersion: 2,
    });
  });
});

describe('MAPPABLE_TARGETS', () => {
  it('includes athlete, guardian, household, and program targets', () => {
    expect(MAPPABLE_TARGETS.athlete).toContain('athlete.first_name');
    expect(MAPPABLE_TARGETS.guardian).toContain('guardian.email');
    expect(MAPPABLE_TARGETS.household).toContain('household.name');
    expect(MAPPABLE_TARGETS.program).toContain('program.type');
  });
});
