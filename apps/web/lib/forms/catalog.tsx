import type { LucideIcon } from 'lucide-react';
import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Calendar,
  Cake,
  List,
  ListChecks,
  CircleDot,
  CheckSquare,
  Upload,
  PenLine,
  Heading,
  Info,
  Ticket,
} from 'lucide-react';
import { FIELD_TYPES, type FieldType } from '@ca-tempo/domain';

/** Grupos amigáveis para a paleta de campos. */
export type FieldGroup = 'text' | 'choice' | 'datetime' | 'special' | 'layout';

export const FIELD_GROUP_ORDER: readonly FieldGroup[] = [
  'text',
  'choice',
  'datetime',
  'special',
  'layout',
];

/** Ícone por tipo de campo (usado na paleta, nos cards e no painel). */
export const FIELD_ICON: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  email: Mail,
  phone: Phone,
  date: Calendar,
  dob: Cake,
  select: List,
  multiselect: ListChecks,
  radio: CircleDot,
  checkbox: CheckSquare,
  upload: Upload,
  signature: PenLine,
  header: Heading,
  info: Info,
  pass_selector: Ticket,
};

/** A qual grupo cada tipo pertence. */
export const FIELD_GROUP: Record<FieldType, FieldGroup> = {
  text: 'text',
  textarea: 'text',
  email: 'text',
  phone: 'text',
  radio: 'choice',
  select: 'choice',
  multiselect: 'choice',
  checkbox: 'choice',
  date: 'datetime',
  dob: 'datetime',
  upload: 'special',
  signature: 'special',
  pass_selector: 'special',
  header: 'layout',
  info: 'layout',
};

/** Tipos organizados por grupo, preservando a ordem do enum de domínio. */
export const FIELDS_BY_GROUP: Record<FieldGroup, FieldType[]> = FIELD_GROUP_ORDER.reduce(
  (acc, group) => {
    acc[group] = FIELD_TYPES.filter((type) => FIELD_GROUP[type] === group);
    return acc;
  },
  { text: [], choice: [], datetime: [], special: [], layout: [] } as Record<FieldGroup, FieldType[]>,
);
