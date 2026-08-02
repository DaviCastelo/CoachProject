'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type StatusResult = { ok: true } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** Aprova/rejeita uma inscrição. Só owner/admin. Escopo garantido pela org ativa + RLS. */
export async function setRegistrationStatus(
  id: string,
  status: 'approved' | 'rejected',
): Promise<StatusResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await getDb();

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'approved') {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = ctx.userId;
    patch.canceled_at = null;
  } else {
    patch.canceled_at = new Date().toISOString();
    patch.cancellation_reason = 'rejected by staff';
  }

  const { error } = await db
    .from('registrations')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.orgId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Gera uma URL assinada (2 min) do PDF do waiver mais recente do atleta. */
export async function getWaiverUrl(athleteId: string): Promise<string | null> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = await getDb();

  const { data } = await db
    .from('waiver_signatures')
    .select('pdf_url')
    .eq('organization_id', ctx.orgId)
    .eq('athlete_id', athleteId)
    .not('pdf_url', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const path = (data as { pdf_url: string | null } | null)?.pdf_url;
  if (!path) return null;

  // Storage signed URLs require service role (no RLS on bucket access via user JWT).
  const svc = createServiceClient();
  const { data: signed } = await svc.storage.from('waivers').createSignedUrl(path, 120);
  return signed?.signedUrl ?? null;
}
