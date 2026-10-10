/*
 * Superfície pública dos tipos do banco.
 *
 * `generated.ts` é saída de ferramenta: ninguém edita à mão, e `pnpm db:types`
 * reescreve o arquivo inteiro a partir do schema. Este arquivo é a camada
 * curada em cima dele, e é o único dos dois que se lê.
 *
 * A versão anterior deste arquivo era um `Database` escrito à mão, e foi assim
 * que ele apodreceu: tinha 231 linhas contra as 2.592 do schema real, sem uma
 * única menção a invoices, payments ou notifications. Todo o módulo de
 * cobrança acabou escrito com `as unknown as SupabaseClient` porque o tipo
 * gerado não existia.
 *
 * Por isso os apelidos abaixo são DERIVADOS dos enums gerados, nunca literais
 * repetidos: `OrgRole` escrito na mão continua compilando depois de alguém
 * adicionar um papel novo no banco, e aí mente em silêncio.
 */

import type { Database } from './generated';

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from './generated';

export { Constants } from './generated';

type PublicEnums = Database['public']['Enums'];

export type OrgRole = PublicEnums['org_role'];
export type AthleteStatus = PublicEnums['athlete_status'];
export type RegistrationStatus = PublicEnums['registration_status'];
export type ProgramType = PublicEnums['program_type'];
export type GroupMemberStatus = PublicEnums['group_member_status'];
export type AttendanceStatus = PublicEnums['attendance_status'];
export type AnnouncementStatus = PublicEnums['announcement_status'];
export type SessionStatus = PublicEnums['session_status'];

/* Cobrança (migrations 0028 em diante). */
export type InvoiceStatus = PublicEnums['invoice_status'];
export type PaymentProvider = PublicEnums['payment_provider'];
export type PaymentMethod = PublicEnums['payment_method'];
export type PaymentStatus = PublicEnums['payment_status'];
