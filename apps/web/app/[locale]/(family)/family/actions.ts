'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export type FamilyAthlete = { id: string; name: string };

export type FamilyEvent = {
  attendanceId: string;
  sessionId: string;
  athleteId: string;
  athleteName: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  status: string;          // status do evento
  fieldLabel: string | null;
  rsvp: string;            // status do RSVP deste atleta
  groupNames: string[];
};

/**
 * Agenda da família: eventos dos grupos de cada atleta sob responsabilidade
 * do usuário. Uma linha por (evento, atleta) — um pai com 2 filhos vê os dois,
 * cada um com o seu próprio RSVP (brief §12).
 */
export async function listFamilyEvents(): Promise<{
  athletes: FamilyAthlete[];
  events: FamilyEvent[];
}> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { athletes: [], events: [] };

  // A RLS já limita a `auth_athlete_ids()`; aqui só lemos o que é permitido.
  const { data: athleteRows } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .is('deleted_at', null);

  const athletes = ((athleteRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
  }[]).map((a) => ({ id: a.id, name: `${a.first_name} ${a.last_name}` }));

  if (athletes.length === 0) return { athletes: [], events: [] };

  const nameById = new Map(athletes.map((a) => [a.id, a.name]));

  const { data: attRows } = await db
    .from('session_attendance')
    .select(
      'id, session_id, athlete_id, status, sessions(title, event_type, starts_at, ends_at, status, field_label)',
    )
    .order('id', { ascending: false })
    .limit(300);

  const rows = (attRows ?? []) as unknown as {
    id: string;
    session_id: string;
    athlete_id: string;
    status: string;
    sessions: {
      title: string;
      event_type: string;
      starts_at: string;
      ends_at: string;
      status: string;
      field_label: string | null;
    } | null;
  }[];

  const sessionIds = [...new Set(rows.map((r) => r.session_id))];
  const groupsBySession = new Map<string, string[]>();
  if (sessionIds.length > 0) {
    const { data: groupRows } = await db
      .from('session_groups')
      .select('session_id, groups(name)')
      .in('session_id', sessionIds);

    for (const g of (groupRows ?? []) as unknown as {
      session_id: string;
      groups: { name: string } | null;
    }[]) {
      if (!g.groups) continue;
      const list = groupsBySession.get(g.session_id) ?? [];
      list.push(g.groups.name);
      groupsBySession.set(g.session_id, list);
    }
  }

  const events: FamilyEvent[] = rows
    .filter((r) => r.sessions !== null)
    .map((r) => ({
      attendanceId: r.id,
      sessionId: r.session_id,
      athleteId: r.athlete_id,
      athleteName: nameById.get(r.athlete_id) ?? '—',
      title: r.sessions?.title ?? '—',
      eventType: r.sessions?.event_type ?? 'training',
      startsAt: r.sessions?.starts_at ?? '',
      endsAt: r.sessions?.ends_at ?? '',
      status: r.sessions?.status ?? 'scheduled',
      fieldLabel: r.sessions?.field_label ?? null,
      rsvp: r.status,
      groupNames: groupsBySession.get(r.session_id) ?? [],
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return { athletes, events };
}

/**
 * Responde o RSVP. A RPC valida que o atleta está sob a responsabilidade do
 * usuário e grava `responded_by` (auditoria de QUEM respondeu — brief §12).
 */
export async function respondRsvp(
  sessionId: string,
  athleteId: string,
  status: 'confirmed' | 'declined' | 'invited',
): Promise<ActionResult> {
  const db = await getDb();

  const { error } = await db.rpc('respond_rsvp', {
    p_session_id: sessionId,
    p_athlete_id: athleteId,
    p_status: status,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/family');
  return { ok: true };
}

export type FamilyAnnouncement = {
  id: string;
  title: string;
  body: string;
  sentAt: string | null;
  readAt: string | null;
};

/** Anúncios recebidos pelo usuário (materializados no envio). */
export async function listFamilyAnnouncements(): Promise<FamilyAnnouncement[]> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data } = await db
    .from('announcement_recipients')
    .select('announcement_id, read_at, announcements(title, body, sent_at)')
    .eq('profile_id', user.id)
    .limit(100);

  return ((data ?? []) as unknown as {
    announcement_id: string;
    read_at: string | null;
    announcements: { title: string; body: string; sent_at: string | null } | null;
  }[])
    .filter((r) => r.announcements !== null)
    .map((r) => ({
      id: r.announcement_id,
      title: r.announcements?.title ?? '',
      body: r.announcements?.body ?? '',
      sentAt: r.announcements?.sent_at ?? null,
      readAt: r.read_at,
    }))
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
}

export async function markAnnouncementRead(announcementId: string): Promise<ActionResult> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await db
    .from('announcement_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('announcement_id', announcementId)
    .eq('profile_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/family');
  return { ok: true };
}
