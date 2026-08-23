import { describe, it, expect } from 'vitest';
import { parseFormSchema, collectableFields, type FormSchema } from './schema';
import { isFieldVisible } from './conditional';
import { mapSubmissionToEntities } from './mapping';
import { validateSubmission } from './validate';
import {
  extractSignatureFromSchema,
  hasSignatureField,
  isDrawnSignatureValue,
} from './signature';

// Formulário de exemplo (baseado no schema do docs/03 / camp da CA Tempo).
const campForm: FormSchema = parseFormSchema({
  sections: [
    {
      id: 'athlete',
      title: 'Athlete Information',
      fields: [
        { id: 'first_name', type: 'text', label: 'First Name', required: true, mapsTo: 'athlete.first_name' },
        { id: 'last_name', type: 'text', label: 'Last Name', required: true, mapsTo: 'athlete.last_name' },
        {
          id: 'dob',
          type: 'dob',
          label: 'Birth Date',
          required: true,
          mapsTo: 'athlete.date_of_birth',
          validation: { minYear: 2013, maxYear: 2018 },
        },
        {
          id: 'level',
          type: 'select',
          label: 'Playing Level',
          options: ['GOLD', 'PREMIER', 'ECNL'],
          mapsTo: 'athlete.playing_level',
        },
        {
          id: 'shirt',
          type: 'select',
          label: 'Shirt Size',
          options: ['Youth S', 'Youth M', 'Adult M'],
          mapsTo: 'athlete.jersey_size',
          showIf: { field: 'program.type', equals: 'camp' },
        },
      ],
    },
    {
      id: 'guardian',
      title: 'Guardian',
      fields: [
        { id: 'g_header', type: 'header', label: 'Parent / Guardian' },
        { id: 'g_email', type: 'email', label: 'Email', required: true, mapsTo: 'guardian.email' },
        { id: 'notes', type: 'textarea', label: 'Notes' },
      ],
    },
  ],
});

describe('parseFormSchema', () => {
  it('applies defaults (required=false) and keeps structure', () => {
    expect(campForm.sections).toHaveLength(2);
    const notes = campForm.sections[1].fields.find((f) => f.id === 'notes');
    expect(notes?.required).toBe(false);
  });

  it('rejects an invalid field type', () => {
    expect(() =>
      parseFormSchema({ sections: [{ id: 's', fields: [{ id: 'x', type: 'wizardry' }] }] }),
    ).toThrow();
  });
});

describe('collectableFields', () => {
  it('excludes header/info fields', () => {
    const ids = collectableFields(campForm).map((f) => f.id);
    expect(ids).toContain('first_name');
    expect(ids).not.toContain('g_header');
  });
});

describe('isFieldVisible', () => {
  const shirt = campForm.sections[0].fields.find((f) => f.id === 'shirt')!;

  it('shows a field when showIf matches', () => {
    expect(isFieldVisible(shirt, { 'program.type': 'camp' })).toBe(true);
  });

  it('hides a field when showIf does not match', () => {
    expect(isFieldVisible(shirt, { 'program.type': 'private_1on1' })).toBe(false);
  });

  it('always shows a field without showIf', () => {
    const firstName = campForm.sections[0].fields[0];
    expect(isFieldVisible(firstName, {})).toBe(true);
  });
});

describe('mapSubmissionToEntities', () => {
  it('routes values to their domain entities via mapsTo', () => {
    const mapped = mapSubmissionToEntities(campForm, {
      first_name: 'Lucas',
      last_name: 'Silva',
      dob: '2015-05-01',
      level: 'PREMIER',
      g_email: 'maria@example.com',
      notes: 'peanut allergy',
    });
    expect(mapped.athlete).toEqual({
      first_name: 'Lucas',
      last_name: 'Silva',
      date_of_birth: '2015-05-01',
      playing_level: 'PREMIER',
    });
    expect(mapped.guardian).toEqual({ email: 'maria@example.com' });
    expect(mapped.extra).toEqual({ notes: 'peanut allergy' });
  });
});

describe('validateSubmission', () => {
  const base = {
    first_name: 'Lucas',
    last_name: 'Silva',
    dob: '2015-05-01',
    level: 'PREMIER',
    g_email: 'maria@example.com',
    'program.type': 'camp',
    shirt: 'Youth M',
  };

  it('passes a valid submission', () => {
    expect(validateSubmission(campForm, base)).toEqual({ ok: true });
  });

  it('flags missing required fields', () => {
    const { first_name, ...rest } = base;
    void first_name;
    const result = validateSubmission(campForm, rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'first_name', message: 'required' });
    }
  });

  it('enforces birth-year bounds', () => {
    const result = validateSubmission(campForm, { ...base, dob: '2011-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'dob', message: 'minYear:2013' });
    }
  });

  it('rejects an out-of-list select option', () => {
    const result = validateSubmission(campForm, { ...base, level: 'MADE_UP' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'level', message: 'invalid_option' });
    }
  });

  it('rejects an invalid email', () => {
    const result = validateSubmission(campForm, { ...base, g_email: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'g_email', message: 'invalid_email' });
    }
  });

  it('does not require a hidden conditional field', () => {
    const { shirt, ...noShirt } = base;
    void shirt;
    // shirt is hidden when program.type != camp → not required
    const result = validateSubmission(campForm, { ...noShirt, 'program.type': 'private_1on1' });
    expect(result).toEqual({ ok: true });
  });
});

describe('signature field helpers', () => {
  const formWithSignature = parseFormSchema({
    sections: [
      {
        id: 'sig',
        fields: [
          { id: 'sig_field', type: 'signature', label: 'Signature', required: true },
        ],
      },
    ],
  });

  it('detects signature fields in schema', () => {
    expect(hasSignatureField(formWithSignature)).toBe(true);
    expect(hasSignatureField(campForm)).toBe(false);
  });

  it('extracts drawn signature from form data', () => {
    const png = 'data:image/png;base64,abc';
    expect(extractSignatureFromSchema(formWithSignature, { sig_field: png })).toEqual({
      signatureType: 'drawn',
      signatureData: png,
    });
    expect(isDrawnSignatureValue(png)).toBe(true);
  });

  it('extracts typed signature from form data', () => {
    expect(extractSignatureFromSchema(formWithSignature, { sig_field: 'Maria Silva' })).toEqual({
      signatureType: 'typed',
      signatureData: 'Maria Silva',
    });
  });

  it('requires signature when marked required', () => {
    const result = validateSubmission(formWithSignature, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'sig_field', message: 'required' });
    }
  });

  it('rejects a one-character typed signature', () => {
    const result = validateSubmission(formWithSignature, { sig_field: 'A' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ fieldId: 'sig_field', message: 'invalid_signature' });
    }
  });
});
