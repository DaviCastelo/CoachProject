'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type ProfileResult = { ok: true } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export type OwnProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  locale: string | null;
};

/** Perfil do usuário logado — vale para qualquer papel (admin, coach, família, atleta). */
export async function getOwnProfile(): Promise<OwnProfile | null> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data } = await db
    .from('profiles')
    .select('id, full_name, email, phone, locale')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;
  const p = data as {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    locale: string | null;
  };

  return {
    id: p.id,
    fullName: p.full_name ?? '',
    email: p.email,
    phone: p.phone ?? '',
    locale: p.locale,
  };
}

/**
 * Atualiza os próprios dados. A policy `profile_self_update` já limita a linha
 * ao próprio usuário; o e-mail não é editável aqui porque é a credencial de login.
 */
export async function updateOwnProfile(input: {
  fullName: string;
  phone?: string;
}): Promise<ProfileResult> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: 'name_required' };

  const { error } = await db
    .from('profiles')
    .update({
      full_name: fullName,
      phone: input.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
