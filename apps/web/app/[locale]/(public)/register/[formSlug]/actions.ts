'use server';

import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAnonServerClient } from '@/lib/supabase/anon-server';
import { createClient } from '@/lib/supabase/server';
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

type SubmitErrorCode = Extract<SubmitResult, { ok: false; error: string }>['error'];

function mapRpcError(message: string): SubmitErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('form_not_found')) return 'not_found';
  if (lower.includes('first_name, last_name and date_of_birth')) return 'incomplete_mapping';
  if (lower.includes('forbidden')) return 'server_error';
  if (isRlsViolation({ message })) return 'config_error';
  return 'server_error';
}

type SessionGuardian = { first_name: string; last_name: string; email: string };

async function sessionGuardian(db: SupabaseClient, userId: string): Promise<SessionGuardian | null> {
  const { data } = await db
    .from('guardians')
    .select('first_name, last_name, email')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const row = data as SessionGuardian | null;
  if (!row?.email) return null;
  return row;
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

  const { form, schema, entities } = loaded;
  const program = await loadProgram(readClient, form.id);
  const programOptionId = await resolveProgramOptionId(readClient, program?.id ?? null, extras?.programOptionId);
  const { ip, userAgent } = await readRequestMeta();

  const session = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await session.auth.getUser();
  const guardian = user ? await sessionGuardian(session, user.id) : null;
  if (guardian) {
    entities.guardian.email = guardian.email;
    entities.guardian.first_name = guardian.first_name;
    entities.guardian.last_name = guardian.last_name;
  }

  let pinnedAthleteId: string | null = null;
  const requestedAthleteId = extras?.athleteId ?? null;
  // Sem sessão o id é ignorado: a inscrição segue anônima, pelo que foi digitado.
  if (user && requestedAthleteId) {
    const { data: athlete } = await session
      .from('athletes')
      .select('id, organization_id, first_name, last_name, date_of_birth')
      .eq('id', requestedAthleteId)
      .is('deleted_at', null)
      .maybeSingle();

    const row = athlete as {
      id: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      date_of_birth: string;
    } | null;

    if (!row || row.organization_id !== form.organization_id) {
      return { ok: false, error: 'server_error' };
    }

    entities.athlete.first_name = row.first_name;
    entities.athlete.last_name = row.last_name;
    entities.athlete.date_of_birth = row.date_of_birth;
    pinnedAthleteId = row.id;
  }

  const waiver = await buildWaiverContext(
    readClient,
    form.organization_id,
    program,
    extras,
    entities,
    schema,
    data,
  );
  const waiverPayload = waiver ? waiverToRpcPayload(waiver, ip, userAgent) : null;

  // Com atleta escolhido, o JWT da sessão precisa chegar na RPC.
  // Sem escolha, o client anônimo ignora qualquer id.
  const rpcClient = pinnedAthleteId ? session : readClient;
  const { error: rpcError } = await rpcClient.rpc('submit_public_registration', {
    p_form_version_id: formVersionId,
    p_data: data,
    p_athlete: entities.athlete,
    p_guardian: entities.guardian,
    p_household: entities.household,
    p_program_option_id: programOptionId,
    p_waiver: waiverPayload,
    p_ip: ip,
    p_user_agent: userAgent,
    ...(pinnedAthleteId ? { p_athlete_id: pinnedAthleteId } : {}),
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
