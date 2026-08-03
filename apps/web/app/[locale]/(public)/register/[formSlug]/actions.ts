'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { isRlsViolation } from '@/lib/supabase/service-config';
import {
  buildWaiverContext,
  isVersionContext,
  loadProgram,
  loadVersionContext,
  resolveProgramOptionId,
  uploadWaiverPdf,
  waiverToRpcPayload,
  type RegistrationExtras,
  type SubmitResult,
} from './registration-helpers';

export type { RegistrationExtras, SubmitResult };

type SubmitErrorCode = Extract<SubmitResult, { ok: false; error: string }>['error'];

function mapDbError(error: { message?: string; code?: string } | null): SubmitErrorCode {
  if (isRlsViolation(error)) return 'config_error';
  return 'server_error';
}

async function readRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  return {
    ip: forwardedFor ? forwardedFor.split(',')[0].trim() : null,
    userAgent: h.get('user-agent'),
  };
}

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

  const loaded = await loadVersionContext(svc, formVersionId, data);
  if (!isVersionContext(loaded)) return loaded;

  const { form, entities } = loaded;
  const program = await loadProgram(svc, form.id);
  const programId = program?.id ?? null;
  const programOptionId = await resolveProgramOptionId(svc, programId, extras?.programOptionId);
  const { ip, userAgent } = await readRequestMeta();
  const waiver = await buildWaiverContext(svc, program, extras, entities);
  const waiverPayload = waiver ? waiverToRpcPayload(waiver, ip, userAgent) : null;

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

  if (insertError || !inserted) {
    return { ok: false, error: mapDbError(insertError) };
  }

  const submissionId = (inserted as { id: string }).id;
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
    return { ok: false, error: mapDbError(pipelineError) };
  }

  if (waiver) {
    await uploadWaiverPdf(svc, waiver, form.organization_id, ip);
  }

  return { ok: true };
}
