'use server';

import { headers } from 'next/headers';
import { createAnonServerClient } from '@/lib/supabase/anon-server';
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

function mapRpcError(message: string): SubmitErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('form_not_found')) return 'not_found';
  if (lower.includes('first_name, last_name and date_of_birth')) return 'incomplete_mapping';
  if (isRlsViolation({ message })) return 'config_error';
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
 * Pipeline de inscrição (docs/04 › M1). Usa RPC SECURITY DEFINER para gravar
 * form_submissions + pipeline mesmo quando a service role não está configurada.
 */
export async function submitRegistration(
  formVersionId: string,
  data: Record<string, unknown>,
  extras?: RegistrationExtras,
): Promise<SubmitResult> {
  const readClient = createAnonServerClient();
  const svc = createServiceClient();

  const loaded = await loadVersionContext(readClient, formVersionId, data);
  if (!isVersionContext(loaded)) return loaded;

  const { form, entities } = loaded;
  const program = await loadProgram(readClient, form.id);
  const programId = program?.id ?? null;
  const programOptionId = await resolveProgramOptionId(readClient, programId, extras?.programOptionId);
  const { ip, userAgent } = await readRequestMeta();
  const waiver = await buildWaiverContext(readClient, program, extras, entities);
  const waiverPayload = waiver ? waiverToRpcPayload(waiver, ip, userAgent) : null;

  const { error: rpcError } = await readClient.rpc('submit_public_registration', {
    p_form_version_id: formVersionId,
    p_data: data,
    p_athlete: entities.athlete,
    p_guardian: entities.guardian,
    p_household: entities.household,
    p_program_option_id: programOptionId,
    p_waiver: waiverPayload,
    p_ip: ip,
    p_user_agent: userAgent,
  });

  if (rpcError) {
    return { ok: false, error: mapRpcError(rpcError.message) };
  }

  if (waiver) {
    try {
      await uploadWaiverPdf(svc, waiver, form.organization_id, ip);
    } catch {
      // PDF auxiliar; falha silenciosa se service role indisponível.
    }
  }

  return { ok: true };
}
