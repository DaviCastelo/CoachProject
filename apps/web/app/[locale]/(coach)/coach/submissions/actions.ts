'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type StatusResult = { ok: true } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export type AssignableGroup = {
  id: string;
  name: string;
  parentGroupId: string | null;
  sortOrder: number;
};

/** Grupos da org para o seletor de atribuição na aprovação (brief §5). */
export async function listGroupsForAssignment(): Promise<AssignableGroup[]> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = await getDb();

  const { data } = await db
    .from('groups')
    .select('id, name, parent_group_id, sort_order')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  return ((data ?? []) as {
    id: string;
    name: string;
    parent_group_id: string | null;
    sort_order: number | null;
  }[]).map((g) => ({
    id: g.id,
    name: g.name,
    parentGroupId: g.parent_group_id,
    sortOrder: g.sort_order ?? 0,
  }));
}

/**
 * Aprova a inscrição e atribui o atleta a 1..N grupos, via RPC transacional
 * (aprova + ativa o atleta + cria as participações). Brief §5 e §22.
 */
export async function approveRegistrationWithGroups(
  registrationId: string,
  groupIds: string[],
): Promise<StatusResult> {
  await requireRole(['owner', 'admin']);
  const db = await getDb();

  const { error } = await db.rpc('approve_registration_with_groups', {
    p_registration_id: registrationId,
    p_group_ids: groupIds,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/submissions');
  revalidatePath('/coach/groups');
  return { ok: true };
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

export type RegistrationDetails = {
  status: string;
  createdAt: string;
  program: string | null;
  option: string | null;
  athlete: Record<string, string> | null;
  data: Record<string, unknown>;
};

/** Detalhes completos de uma inscrição para o popup (staff). */
export async function getRegistrationDetails(id: string): Promise<RegistrationDetails | null> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = await getDb();

  const { data } = await db
    .from('registrations')
    .select(
      'status, created_at, athletes(first_name, last_name, date_of_birth, gender, current_club, playing_level, jersey_size, allergies, medical_notes), programs(name), program_options(name), form_submissions(data)',
    )
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!data) return null;
  const row = data as unknown as {
    status: string;
    created_at: string;
    athletes: Record<string, string | null> | null;
    programs: { name: string } | null;
    program_options: { name: string } | null;
    form_submissions: { data: Record<string, unknown> } | null;
  };

  const athlete = row.athletes
    ? (Object.fromEntries(
        Object.entries(row.athletes).filter(([, v]) => v != null && v !== ''),
      ) as Record<string, string>)
    : null;

  return {
    status: row.status,
    createdAt: row.created_at,
    program: row.programs?.name ?? null,
    option: row.program_options?.name ?? null,
    athlete,
    data: row.form_submissions?.data ?? {},
  };
}
