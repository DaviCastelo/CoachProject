import type { FieldType, FormField, FormSchema } from '@ca-tempo/domain';

/**
 * Modelos iniciais de formulário.
 *
 * O conteúdo (rótulos, opções, seções) é o do próprio formulário que a família
 * lê, e não muda com o idioma do painel. Fica em inglês americano porque o
 * clube atende famílias nos EUA: antes vinha em português, e um formulário
 * criado a partir do modelo ia para as famílias com "Nome do responsável". O
 * coach continua livre para editar. Os nomes dos modelos na tela vêm do i18n.
 */
export type TemplateId = 'registration' | 'camp' | 'evaluation';

export const TEMPLATE_IDS: readonly TemplateId[] = ['registration', 'camp', 'evaluation'];

type FieldSpec = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  mapsTo?: string;
  options?: string[];
  helpText?: string;
  placeholder?: string;
};

function field(spec: FieldSpec): FormField {
  return {
    id: spec.id,
    type: spec.type,
    label: spec.label,
    required: spec.required ?? false,
    ...(spec.mapsTo ? { mapsTo: spec.mapsTo } : {}),
    ...(spec.options ? { options: spec.options } : {}),
    ...(spec.helpText ? { helpText: spec.helpText } : {}),
    ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
  };
}

const GENDER = ['Female', 'Male', 'Other'];
const RELATIONSHIP = ['Mother', 'Father', 'Legal guardian'];
const JERSEY = ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL'];

function registrationSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'athlete',
        title: 'Athlete',
        description: 'About the player.',
        fields: [
          field({ id: 'athlete_first_name', type: 'text', label: 'Athlete first name', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'athlete_last_name', type: 'text', label: 'Athlete last name', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'athlete_dob', type: 'dob', label: 'Date of birth', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'athlete_gender', type: 'radio', label: 'Gender', options: GENDER, mapsTo: 'athlete.gender' }),
          field({ id: 'athlete_club', type: 'text', label: 'Current club', mapsTo: 'athlete.current_club' }),
        ],
      },
      {
        id: 'guardian',
        title: 'Parent or guardian',
        description: 'Who we should contact about the athlete.',
        fields: [
          field({ id: 'guardian_first_name', type: 'text', label: 'First name', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'guardian_last_name', type: 'text', label: 'Last name', required: true, mapsTo: 'guardian.last_name' }),
          field({ id: 'guardian_email', type: 'email', label: 'Email', required: true, mapsTo: 'guardian.email' }),
          field({ id: 'guardian_phone', type: 'phone', label: 'Phone', required: true, mapsTo: 'guardian.phone' }),
          field({ id: 'guardian_relationship', type: 'radio', label: 'Relationship to the athlete', options: RELATIONSHIP, mapsTo: 'guardian.relationship' }),
        ],
      },
      {
        id: 'health',
        title: 'Health',
        description: 'Helps our coaches take good care of your athlete.',
        fields: [
          field({ id: 'health_allergies', type: 'textarea', label: 'Allergies', mapsTo: 'athlete.allergies', helpText: 'Leave blank if none.' }),
          field({ id: 'health_notes', type: 'textarea', label: 'Medical notes', mapsTo: 'athlete.medical_notes' }),
        ],
      },
    ],
  };
}

function campSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'athlete',
        title: 'Athlete',
        fields: [
          field({ id: 'athlete_first_name', type: 'text', label: 'Athlete first name', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'athlete_last_name', type: 'text', label: 'Athlete last name', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'athlete_dob', type: 'dob', label: 'Date of birth', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'athlete_jersey', type: 'select', label: 'Jersey size', options: JERSEY, mapsTo: 'athlete.jersey_size' }),
        ],
      },
      {
        id: 'camp',
        title: 'About the camp',
        fields: [
          field({ id: 'camp_session', type: 'radio', label: 'Session', required: true, options: ['Morning', 'Afternoon'] }),
          field({ id: 'camp_allergies', type: 'textarea', label: 'Allergies or dietary restrictions', mapsTo: 'athlete.allergies' }),
        ],
      },
      {
        id: 'guardian',
        title: 'Parent or guardian',
        fields: [
          field({ id: 'guardian_first_name', type: 'text', label: 'Parent or guardian first name', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'guardian_email', type: 'email', label: 'Email', required: true, mapsTo: 'guardian.email' }),
          field({ id: 'guardian_phone', type: 'phone', label: 'Phone', required: true, mapsTo: 'guardian.phone' }),
        ],
      },
    ],
  };
}

function evaluationSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'athlete',
        title: 'Athlete',
        fields: [
          field({ id: 'athlete_first_name', type: 'text', label: 'Athlete first name', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'athlete_last_name', type: 'text', label: 'Athlete last name', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'athlete_dob', type: 'dob', label: 'Date of birth', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'athlete_foot', type: 'radio', label: 'Dominant foot', options: ['Right', 'Left', 'Both'], mapsTo: 'athlete.dominant_foot' }),
          field({ id: 'athlete_level', type: 'radio', label: 'Level', options: ['Beginner', 'Intermediate', 'Advanced'], mapsTo: 'athlete.playing_level' }),
        ],
      },
      {
        id: 'goals',
        title: 'Goals',
        fields: [
          field({ id: 'goals_short_term', type: 'textarea', label: 'Short-term goals', mapsTo: 'athlete.short_term_goals' }),
          field({ id: 'goals_long_term', type: 'textarea', label: 'Long-term goals', mapsTo: 'athlete.long_term_goals' }),
        ],
      },
      {
        id: 'guardian',
        title: 'Parent or guardian contact',
        fields: [
          field({ id: 'guardian_first_name', type: 'text', label: 'Parent or guardian first name', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'guardian_email', type: 'email', label: 'Email', required: true, mapsTo: 'guardian.email' }),
        ],
      },
    ],
  };
}

export const TEMPLATES: Record<TemplateId, () => FormSchema> = {
  registration: registrationSchema,
  camp: campSchema,
  evaluation: evaluationSchema,
};
