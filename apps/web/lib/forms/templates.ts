import type { FieldType, FormField, FormSchema } from '@ca-tempo/domain';

/**
 * Modelos iniciais de formulário. O conteúdo (rótulos/opções) fica em português
 * porque é o conteúdo do próprio formulário que o treinador vai revisar e editar —
 * não é chrome de UI. Os nomes/descrições dos modelos na tela vêm do i18n.
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

const GENDER = ['Masculino', 'Feminino', 'Outro'];
const RELATIONSHIP = ['Mãe', 'Pai', 'Responsável legal'];
const JERSEY = ['PP', 'P', 'M', 'G', 'GG'];

function registrationSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'atleta',
        title: 'Dados do atleta',
        description: 'Informações da criança/atleta.',
        fields: [
          field({ id: 'atleta_nome', type: 'text', label: 'Nome do atleta', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'atleta_sobrenome', type: 'text', label: 'Sobrenome do atleta', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'atleta_nascimento', type: 'dob', label: 'Data de nascimento', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'atleta_genero', type: 'radio', label: 'Gênero', options: GENDER, mapsTo: 'athlete.gender' }),
          field({ id: 'atleta_clube', type: 'text', label: 'Clube atual', mapsTo: 'athlete.current_club' }),
        ],
      },
      {
        id: 'responsavel',
        title: 'Responsável',
        description: 'Quem podemos contatar sobre o atleta.',
        fields: [
          field({ id: 'resp_nome', type: 'text', label: 'Nome do responsável', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'resp_sobrenome', type: 'text', label: 'Sobrenome do responsável', required: true, mapsTo: 'guardian.last_name' }),
          field({ id: 'resp_email', type: 'email', label: 'E-mail do responsável', required: true, mapsTo: 'guardian.email' }),
          field({ id: 'resp_telefone', type: 'phone', label: 'Telefone do responsável', required: true, mapsTo: 'guardian.phone' }),
          field({ id: 'resp_parentesco', type: 'radio', label: 'Parentesco', options: RELATIONSHIP, mapsTo: 'guardian.relationship' }),
        ],
      },
      {
        id: 'saude',
        title: 'Saúde',
        description: 'Ajuda a equipe a cuidar melhor do atleta.',
        fields: [
          field({ id: 'saude_alergias', type: 'textarea', label: 'Alergias', mapsTo: 'athlete.allergies', helpText: 'Deixe em branco se não houver.' }),
          field({ id: 'saude_obs', type: 'textarea', label: 'Observações médicas', mapsTo: 'athlete.medical_notes' }),
        ],
      },
    ],
  };
}

function campSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'atleta',
        title: 'Dados do atleta',
        fields: [
          field({ id: 'atleta_nome', type: 'text', label: 'Nome do atleta', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'atleta_sobrenome', type: 'text', label: 'Sobrenome do atleta', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'atleta_nascimento', type: 'dob', label: 'Data de nascimento', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'atleta_camiseta', type: 'select', label: 'Tamanho da camiseta', options: JERSEY, mapsTo: 'athlete.jersey_size' }),
        ],
      },
      {
        id: 'camp',
        title: 'Sobre o camp',
        fields: [
          field({ id: 'camp_turma', type: 'radio', label: 'Turma', required: true, options: ['Manhã', 'Tarde'] }),
          field({ id: 'camp_alergias', type: 'textarea', label: 'Alergias / restrições alimentares', mapsTo: 'athlete.allergies' }),
        ],
      },
      {
        id: 'responsavel',
        title: 'Responsável',
        fields: [
          field({ id: 'resp_nome', type: 'text', label: 'Nome do responsável', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'resp_email', type: 'email', label: 'E-mail do responsável', required: true, mapsTo: 'guardian.email' }),
          field({ id: 'resp_telefone', type: 'phone', label: 'Telefone do responsável', required: true, mapsTo: 'guardian.phone' }),
        ],
      },
    ],
  };
}

function evaluationSchema(): FormSchema {
  return {
    sections: [
      {
        id: 'atleta',
        title: 'Dados do atleta',
        fields: [
          field({ id: 'atleta_nome', type: 'text', label: 'Nome do atleta', required: true, mapsTo: 'athlete.first_name' }),
          field({ id: 'atleta_sobrenome', type: 'text', label: 'Sobrenome do atleta', required: true, mapsTo: 'athlete.last_name' }),
          field({ id: 'atleta_nascimento', type: 'dob', label: 'Data de nascimento', required: true, mapsTo: 'athlete.date_of_birth' }),
          field({ id: 'atleta_pe', type: 'radio', label: 'Pé dominante', options: ['Direito', 'Esquerdo', 'Ambos'], mapsTo: 'athlete.dominant_foot' }),
          field({ id: 'atleta_nivel', type: 'radio', label: 'Nível', options: ['Iniciante', 'Intermediário', 'Avançado'], mapsTo: 'athlete.playing_level' }),
        ],
      },
      {
        id: 'objetivos',
        title: 'Objetivos',
        fields: [
          field({ id: 'obj_curto', type: 'textarea', label: 'Objetivos de curto prazo', mapsTo: 'athlete.short_term_goals' }),
          field({ id: 'obj_longo', type: 'textarea', label: 'Objetivos de longo prazo', mapsTo: 'athlete.long_term_goals' }),
        ],
      },
      {
        id: 'responsavel',
        title: 'Contato do responsável',
        fields: [
          field({ id: 'resp_nome', type: 'text', label: 'Nome do responsável', required: true, mapsTo: 'guardian.first_name' }),
          field({ id: 'resp_email', type: 'email', label: 'E-mail do responsável', required: true, mapsTo: 'guardian.email' }),
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
