'use server';

import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import {
  parseFormSchema,
  validateSubmission,
  mapSubmissionToEntities,
  type ValidationError,
} from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';
import { buildWaiverPdf } from '@/lib/waiver-pdf';

export type RegistrationExtras = {
  programOptionId?: string | null;
  waiver?: { signatureType: string; signatureData: string; consent: boolean } | null;
};

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'closed' | 'server_error' | 'incomplete_mapping' }
  | { ok: false; errors: ValidationError[] };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Normaliza datas para ISO (YYYY-MM-DD) antes da RPC Postgres. */
function normalizeDate(value: unknown): string | null {
  const raw = str(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
}

function hasRequiredAthleteMapping(entities: ReturnType<typeof mapSubmissionToEntities>): boolean {
  return Boolean(
    str(entities.athlete.first_name) &&
      str(entities.athlete.last_name) &&
      normalizeDate(entities.athlete.date_of_birth),
  );
}

type WaiverCtx = {
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

/**
 * Pipeline de inscrição (docs/04 › M1). Grava a submissão crua (passo 1 — nada
 * se perde), revalida no servidor, calcula o hash SHA-256 do texto exato do waiver,
 * roda a RPC transacional (dedupe + entidades + registration + assinatura) e gera
 * o PDF do waiver assinado (auxiliar; a assinatura e o hash já ficam persistidos).
 */
export async function submitRegistration(
  formVersionId: string,
  data: Record<string, unknown>,
  extras?: RegistrationExtras,
): Promise<SubmitResult> {
  const svc = createServiceClient();

  const { data: versionRow, error: versionError } = await svc
    .from('form_versions')
    .select('id, schema, forms(id, organization_id, status)')
    .eq('id', formVersionId)
    .maybeSingle();

  if (versionError) return { ok: false, error: 'server_error' };
  if (!versionRow) return { ok: false, error: 'not_found' };

  const version = versionRow as unknown as {
    id: string;
    schema: unknown;
    forms: { id: string; organization_id: string; status: string } | null;
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

  // Programa vinculado a este formulário
  const { data: program } = await svc
    .from('programs')
    .select('id, name, waiver_template_id')
    .eq('form_id', form.id)
    .eq('status', 'published')
    .maybeSingle();

  const programId: string | null = program?.id ?? null;

  // Opção (pass): valida que pertence ao programa
  let programOptionId: string | null = null;
  if (extras?.programOptionId && programId) {
    const { data: opt } = await svc
      .from('program_options')
      .select('id')
      .eq('id', extras.programOptionId)
      .eq('program_id', programId)
      .maybeSingle();
    programOptionId = opt?.id ?? null;
  }

  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
  const userAgent = h.get('user-agent');

  // Waiver: carrega o template, calcula o hash do texto exato assinado
  let waiver: WaiverCtx | null = null;
  if (extras?.waiver && program?.waiver_template_id) {
    const { data: tpl } = await svc
      .from('waiver_templates')
      .select('name, body_markdown')
      .eq('id', program.waiver_template_id)
      .maybeSingle();
    if (tpl) {
      const body = tpl.body_markdown as string;
      const signerName =
        `${str(entities.guardian.first_name)} ${str(entities.guardian.last_name)}`.trim() ||
        'Guardian';
      waiver = {
        templateId: program.waiver_template_id,
        title: tpl.name as string,
        body,
        documentHash: createHash('sha256').update(body).digest('hex'),
        signerName,
        signerEmail: str(entities.guardian.email),
        relationship: str(entities.guardian.relationship) || 'guardian',
        signatureType: extras.waiver.signatureType,
        signatureData: extras.waiver.signatureData,
        consent: extras.waiver.consent,
      };
    }
  }

  const waiverPayload = waiver
    ? {
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
      }
    : null;

  // Passo 1: grava a submissão crua — a partir daqui nada se perde.
  const { data: inserted, error: insertError } = await svc
    .from('form_submissions')
    .insert({
      organization_id: form.organization_id,
      form_version_id: formVersionId,
      data,
      status: 'received',
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (insertError || !inserted) return { ok: false, error: 'server_error' };
  const submissionId = (inserted as { id: string }).id;

  // Passos 2–6: pipeline transacional.
  const { error: pipelineError } = await svc.rpc('process_registration_submission', {
    p_submission_id: submissionId,
    p_athlete: entities.athlete,
    p_guardian: entities.guardian,
    p_household: entities.household,
    p_program_id: programId,
    p_program_option_id: programOptionId,
    p_waiver: waiverPayload,
  });

  if (pipelineError) {
    await svc
      .from('form_submissions')
      .update({ status: 'rejected', error: pipelineError.message })
      .eq('id', submissionId);
    return { ok: false, error: 'server_error' };
  }

  // PDF do waiver (auxiliar — assinatura e hash já persistidos pela RPC)
  if (waiver) {
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
      const path = `${form.organization_id}/${randomUUID()}.pdf`;
      const upload = await svc.storage
        .from('waivers')
        .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
      if (!upload.error) {
        await svc
          .from('waiver_signatures')
          .update({ pdf_url: path })
          .eq('organization_id', form.organization_id)
          .eq('waiver_template_id', waiver.templateId)
          .eq('document_hash', waiver.documentHash);
      }
    } catch {
      // PDF é auxiliar; não falha a inscrição.
    }
  }

  return { ok: true };
}
