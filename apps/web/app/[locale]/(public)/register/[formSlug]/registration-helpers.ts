import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseFormSchema,
  validateSubmission,
  mapSubmissionToEntities,
  extractSignatureFromSchema,
  type FormSchema,
  type ValidationError,
} from '@ca-tempo/domain';
import { isRlsViolation } from '@/lib/supabase/service-config';
import { buildWaiverPdf } from '@/lib/waiver-pdf';

export type RegistrationExtras = {
  programOptionId?: string | null;
  waiver?: { signatureType: string; signatureData: string; consent: boolean } | null;
};

type SubmitErrorCode =
  | 'not_found'
  | 'closed'
  | 'server_error'
  | 'incomplete_mapping'
  | 'config_error';

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: SubmitErrorCode }
  | { ok: false; errors: ValidationError[] };

function mapDbError(error: { message?: string; code?: string } | null): SubmitErrorCode {
  if (isRlsViolation(error)) return 'config_error';
  return 'server_error';
}

type FormInfo = { id: string; organization_id: string; status: string };

type VersionContext = {
  form: FormInfo;
  schema: ReturnType<typeof parseFormSchema>;
  entities: ReturnType<typeof mapSubmissionToEntities>;
};

export type WaiverCtx = {
  templateId: string;
  title: string;
  body: string;
  documentHash: string;
  signerName: string;
  signerEmail: string;
  relationship: string;
  signatureType: string;
  signatureData: string;
  consent: boolean;
};

type ProgramRow = { id: string; name: string; waiver_template_id: string | null };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeDate(value: unknown): string | null {
  const raw = str(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw;
}

function hasRequiredAthleteMapping(entities: ReturnType<typeof mapSubmissionToEntities>): boolean {
  return Boolean(
    str(entities.athlete.first_name) &&
      str(entities.athlete.last_name) &&
      normalizeDate(entities.athlete.date_of_birth),
  );
}

export async function loadVersionContext(
  svc: SupabaseClient,
  formVersionId: string,
  data: Record<string, unknown>,
): Promise<SubmitResult | VersionContext> {
  const { data: versionRow, error: versionError } = await svc
    .from('form_versions')
    .select('id, schema, forms(id, organization_id, status)')
    .eq('id', formVersionId)
    .maybeSingle();

  if (versionError) return { ok: false, error: mapDbError(versionError) };
  if (!versionRow) return { ok: false, error: 'not_found' };

  const version = versionRow as unknown as {
    schema: unknown;
    forms: FormInfo | null;
  };
  const form = version.forms;
  if (!form) return { ok: false, error: 'not_found' };
  if (form.status !== 'published') return { ok: false, error: 'closed' };

  const schema = parseFormSchema(version.schema);
  const result = validateSubmission(schema, data);
  if (!result.ok) return { ok: false, errors: result.errors };

  const entities = mapSubmissionToEntities(schema, data);
  const dob = normalizeDate(entities.athlete.date_of_birth);
  if (dob) entities.athlete.date_of_birth = dob;

  if (!hasRequiredAthleteMapping(entities)) {
    return { ok: false, error: 'incomplete_mapping' };
  }

  return { form, schema, entities };
}

export async function loadProgram(
  svc: SupabaseClient,
  formId: string,
): Promise<ProgramRow | null> {
  const { data: program } = await svc
    .from('programs')
    .select('id, name, waiver_template_id')
    .eq('form_id', formId)
    .eq('status', 'published')
    .maybeSingle();
  return (program as ProgramRow | null) ?? null;
}

export async function resolveProgramOptionId(
  svc: SupabaseClient,
  programId: string | null,
  optionId: string | null | undefined,
): Promise<string | null> {
  if (!optionId || !programId) return null;
  const { data: opt } = await svc
    .from('program_options')
    .select('id')
    .eq('id', optionId)
    .eq('program_id', programId)
    .maybeSingle();
  return (opt as { id: string } | null)?.id ?? null;
}

export async function resolveWaiverTemplateId(
  svc: SupabaseClient,
  organizationId: string,
  program: { waiver_template_id: string | null } | null,
): Promise<string | null> {
  if (program?.waiver_template_id) return program.waiver_template_id;

  const { data: tpl } = await svc
    .from('waiver_templates')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (tpl as { id: string } | null)?.id ?? null;
}

export async function buildWaiverContext(
  svc: SupabaseClient,
  organizationId: string,
  program: ProgramRow | null,
  extras: RegistrationExtras | undefined,
  entities: ReturnType<typeof mapSubmissionToEntities>,
  schema: FormSchema,
  data: Record<string, unknown>,
): Promise<WaiverCtx | null> {
  if (!extras?.waiver?.consent) return null;

  const templateId = await resolveWaiverTemplateId(svc, organizationId, program);
  if (!templateId) return null;

  const { data: tpl } = await svc
    .from('waiver_templates')
    .select('name, body_markdown')
    .eq('id', templateId)
    .eq('is_active', true)
    .maybeSingle();
  if (!tpl) return null;

  const body = tpl.body_markdown as string;
  const signerName =
    `${str(entities.guardian.first_name)} ${str(entities.guardian.last_name)}`.trim() ||
    'Guardian';

  const fieldSignature = extractSignatureFromSchema(schema, data);
  const signatureType = fieldSignature?.signatureType ?? extras.waiver.signatureType;
  const signatureData = fieldSignature?.signatureData ?? extras.waiver.signatureData;
  if (!signatureData) return null;

  return {
    templateId,
    title: tpl.name as string,
    body,
    documentHash: createHash('sha256').update(body).digest('hex'),
    signerName,
    signerEmail: str(entities.guardian.email),
    relationship: str(entities.guardian.relationship) || 'guardian',
    signatureType,
    signatureData,
    consent: extras.waiver.consent,
  };
}

export function waiverToRpcPayload(
  waiver: WaiverCtx,
  ip: string | null,
  userAgent: string | null,
) {
  return {
    template_id: waiver.templateId,
    document_hash: waiver.documentHash,
    signature_type: waiver.signatureType,
    signature_data: waiver.signatureData,
    signer_name: waiver.signerName,
    signer_email: waiver.signerEmail,
    signer_relationship: waiver.relationship,
    ip,
    user_agent: userAgent,
    consent: waiver.consent,
  };
}

export async function uploadWaiverPdf(
  svc: SupabaseClient,
  waiver: WaiverCtx,
  organizationId: string,
  ip: string | null,
): Promise<void> {
  try {
    const pdfBytes = await buildWaiverPdf({
      title: waiver.title,
      body: waiver.body,
      signerName: waiver.signerName,
      signerEmail: waiver.signerEmail,
      relationship: waiver.relationship,
      documentHash: waiver.documentHash,
      ip,
      signedAt: new Date(),
      signatureType: waiver.signatureType,
      signatureDataUrl: waiver.signatureType === 'drawn' ? waiver.signatureData : null,
    });
    const path = `${organizationId}/${randomUUID()}.pdf`;
    const upload = await svc.storage
      .from('waivers')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (!upload.error) {
      await svc
        .from('waiver_signatures')
        .update({ pdf_url: path })
        .eq('organization_id', organizationId)
        .eq('waiver_template_id', waiver.templateId)
        .eq('document_hash', waiver.documentHash);
    }
  } catch {
    // PDF é auxiliar; não falha a inscrição.
  }
}

export function isVersionContext(
  value: SubmitResult | VersionContext,
): value is VersionContext {
  return 'form' in value && 'entities' in value;
}

export function isValidationErrors(
  value: SubmitResult | VersionContext,
): value is { ok: false; errors: ValidationError[] } {
  return 'errors' in value && value.ok === false;
}
