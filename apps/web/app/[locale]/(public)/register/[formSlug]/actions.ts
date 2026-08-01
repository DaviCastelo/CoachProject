'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import {
  parseFormSchema,
  validateSubmission,
  mapSubmissionToEntities,
  type ValidationError,
} from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';

export type RegistrationExtras = {
  programOptionId?: string | null;
  waiver?: { signatureType: string; signatureData: string; consent: boolean } | null;
};

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'closed' | 'server_error' }
  | { ok: false; errors: ValidationError[] };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Pipeline de inscrição (docs/04 › M1). Grava a submissão crua (passo 1 — nada
 * se perde), revalida no servidor, calcula o hash SHA-256 do texto exato do waiver
 * e roda a RPC transacional (dedupe + entidades + registration + assinatura).
 * Falhas viram dead-letter (status=rejected) e são reprocessáveis.
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

  // Programa vinculado a este formulário
  const { data: program } = await svc
    .from('programs')
    .select('id, waiver_template_id')
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

  // Waiver: hash SHA-256 do texto exato assinado (calculado no servidor)
  let waiverPayload: Record<string, unknown> | null = null;
  if (extras?.waiver && program?.waiver_template_id) {
    const { data: tpl } = await svc
      .from('waiver_templates')
      .select('body_markdown')
      .eq('id', program.waiver_template_id)
      .maybeSingle();
    if (tpl) {
      const documentHash = createHash('sha256').update(tpl.body_markdown as string).digest('hex');
      const signerName = `${str(entities.guardian.first_name)} ${str(entities.guardian.last_name)}`.trim();
      waiverPayload = {
        template_id: program.waiver_template_id,
        document_hash: documentHash,
        signature_type: extras.waiver.signatureType,
        signature_data: extras.waiver.signatureData,
        signer_name: signerName || 'Guardian',
        signer_email: str(entities.guardian.email),
        signer_relationship: str(entities.guardian.relationship) || 'guardian',
        ip,
        user_agent: userAgent,
        consent: extras.waiver.consent,
      };
    }
  }

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

  return { ok: true };
}
