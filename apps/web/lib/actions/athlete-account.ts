'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AccountResult = { ok: true; id: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export type AthleteAccountInfo = {
  athleteId: string;
  name: string;
  hasAccount: boolean;
  email: string | null;
};

/** O atleta já tem login? (mostra "criar acesso" ou "acesso criado") */
export async function getAthleteAccountInfo(
  athleteId: string,
): Promise<AthleteAccountInfo | null> {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = await getDb();

  const { data } = await db
    .from('athletes')
    .select('id, first_name, last_name, user_id')
    .eq('id', athleteId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!data) return null;
  const a = data as { id: string; first_name: string; last_name: string; user_id: string | null };

  let email: string | null = null;
  if (a.user_id) {
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('id', a.user_id)
      .maybeSingle();
    email = (profile as { email: string } | null)?.email ?? null;
  }

  return {
    athleteId: a.id,
    name: `${a.first_name} ${a.last_name}`,
    hasAccount: Boolean(a.user_id),
    email,
  };
}

/**
 * Cria o acesso do atleta com senha TEMPORÁRIA.
 * O atleta é obrigado a trocar a senha no primeiro login
 * (`profiles.must_change_password`). Admin e coach podem criar.
 */
export async function createAthleteAccount(input: {
  athleteId: string;
  email: string;
  temporaryPassword: string;
}): Promise<AccountResult> {
  const ctx = await requireRole(['owner', 'admin', 'coach']);
  const db = await getDb();

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_email' };
  if (input.temporaryPassword.length < 8) return { ok: false, error: 'weak_password' };

  const { data: athlete } = await db
    .from('athletes')
    .select('id, first_name, last_name, user_id')
    .eq('id', input.athleteId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!athlete) return { ok: false, error: 'athlete_not_found' };
  const a = athlete as { id: string; first_name: string; last_name: string; user_id: string | null };
  if (a.user_id) return { ok: false, error: 'already_has_account' };

  const svc = createServiceClient();

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    password: input.temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: `${a.first_name} ${a.last_name}` },
  });

  if (createError || !created?.user) {
    const msg = createError?.message ?? 'create_failed';
    if (msg.toLowerCase().includes('already')) return { ok: false, error: 'email_taken' };
    return { ok: false, error: msg };
  }

  const userId = created.user.id;

  // Marca a senha como temporária — o app bloqueia o uso até a troca.
  const { error: profileError } = await svc
    .from('profiles')
    .update({
      full_name: `${a.first_name} ${a.last_name}`,
      must_change_password: true,
    })
    .eq('id', userId);

  if (profileError) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: profileError.message };
  }

  const { error: membershipError } = await svc.from('memberships').insert({
    organization_id: ctx.orgId,
    user_id: userId,
    role: 'athlete',
    status: 'active',
    invited_by: ctx.userId,
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  });

  if (membershipError) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: membershipError.message };
  }

  // Liga a conta ao atleta — é isso que faz auth_athlete_ids() resolver.
  const { error: linkError } = await svc
    .from('athletes')
    .update({ user_id: userId })
    .eq('id', input.athleteId);

  if (linkError) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: linkError.message };
  }

  // Os destinatários de um aviso são gravados no envio. Quem ganha login depois
  // ficaria sem ver os avisos já enviados aos seus grupos — este passo os inclui.
  await svc.rpc('backfill_announcements_for_athlete', {
    p_user_id: userId,
    p_athlete_id: input.athleteId,
  });

  revalidatePath('/coach/groups');
  revalidatePath('/coach/submissions');
  return { ok: true, id: userId };
}

/** Redefine a senha do atleta para uma nova temporária (esqueceu a senha). */
export async function resetAthletePassword(
  athleteId: string,
  temporaryPassword: string,
): Promise<SimpleResult> {
  const ctx = await requireRole(['owner', 'admin', 'coach']);
  const db = await getDb();

  if (temporaryPassword.length < 8) return { ok: false, error: 'weak_password' };

  const { data } = await db
    .from('athletes')
    .select('user_id')
    .eq('id', athleteId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  const userId = (data as { user_id: string | null } | null)?.user_id;
  if (!userId) return { ok: false, error: 'no_account' };

  const svc = createServiceClient();

  const { error } = await svc.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });
  if (error) return { ok: false, error: error.message };

  await svc.from('profiles').update({ must_change_password: true }).eq('id', userId);

  return { ok: true };
}

/**
 * Troca da própria senha. Usada no bloqueio do primeiro acesso — só libera
 * o app depois que a flag `must_change_password` cai.
 */
export async function changeOwnPassword(newPassword: string): Promise<SimpleResult> {
  if (newPassword.length < 8) return { ok: false, error: 'weak_password' };

  const db = await getDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) {
    // O Supabase recusa quando a nova senha é igual à atual.
    if (error.message.toLowerCase().includes('should be different')) {
      return { ok: false, error: 'same_password' };
    }
    return { ok: false, error: error.message };
  }

  const { error: flagError } = await db
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);

  if (flagError) return { ok: false, error: flagError.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
