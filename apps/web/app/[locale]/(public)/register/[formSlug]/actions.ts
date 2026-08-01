'use server';

import { headers } from 'next/headers';
import {
  parseFormSchema,
  validateSubmission,
  mapSubmissionToEntities,
  type ValidationError,
} from '@ca-tempo/domain';
import { createServiceClient } from '@/lib/supabase/service';

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'closed' | 'server_error' }
  | { ok: false; errors: ValidationError[] };

/**
 * Passo 1 do pipeline de inscrição (docs/04 › M1): grava o payload cru ANTES de
 * qualquer processamento — nada se perde. Revalida no servidor (nunca confia no
 * cliente) e persiste em `form_submissions` com status 'received'. A criação de
 * household/guardian/athlete/registration + waiver é o próximo incremento.
 */
export async function submitRegistration(
  formVersionId: string,
  data: Record<string, unknown>,
): Promise<SubmitResult> {
  const svc = createServiceClient();

  // Carrega a versão + o formulário (fonte confiável de org e status)
  const { data: versionRow, error: versionError } = await svc
    .from('form_versions')
    .select('id, schema, forms(organization_id, status)')
    .eq('id', formVersionId)
    .maybeSingle();

  if (versionError) return { ok: false, error: 'server_error' };
  if (!versionRow) return { ok: false, error: 'not_found' };

  // Relação to-one → objeto em runtime; o client sem generic infere como array.
  const version = versionRow as unknown as {
    id: string;
    schema: unknown;
    forms: { organization_id: string; status: string } | null;
  };

  const form = version.forms;
  if (!form) return { ok: false, error: 'not_found' };
  if (form.status !== 'published') return { ok: false, error: 'closed' };

  // Revalidação server-side com o schema real
  const schema = parseFormSchema(version.schema);
  const result = validateSubmission(schema, data);
  if (!result.ok) return { ok: false, errors: result.errors };

  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

  // Passo 1: grava a submissão crua — a partir daqui nada se perde.
  const { data: inserted, error: insertError } = await svc
    .from('form_submissions')
    .insert({
      organization_id: form.organization_id,
      form_version_id: formVersionId,
      data,
      status: 'received',
      ip_address: ip,
      user_agent: h.get('user-agent'),
    })
    .select('id')
    .single();

  if (insertError || !inserted) return { ok: false, error: 'server_error' };
  const submissionId = (inserted as { id: string }).id;

  // Passos 2–6: pipeline transacional (dedupe + household/guardian/athlete + registration).
  const entities = mapSubmissionToEntities(schema, data);
  const { error: pipelineError } = await svc.rpc('process_registration_submission', {
    p_submission_id: submissionId,
    p_athlete: entities.athlete,
    p_guardian: entities.guardian,
    p_household: entities.household,
  });

  if (pipelineError) {
    // Dead-letter: a submissão crua permanece salva e reprocessável.
    await svc
      .from('form_submissions')
      .update({ status: 'rejected', error: pipelineError.message })
      .eq('id', submissionId);
    return { ok: false, error: 'server_error' };
  }

  return { ok: true };
}
