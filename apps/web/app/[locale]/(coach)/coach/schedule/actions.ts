'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const STAFF = ['owner', 'admin', 'coach', 'staff'] as const;
const EDITORS = ['owner', 'admin', 'coach'] as const;

export type SessionListItem = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  publishedAt: string | null;
  groupNames: string[];
  going: number;
  notGoing: number;
  noReply: number;
};

export type SessionRosterEntry = {
  athleteId: string;
  name: string;
  status: string;
  respondedAt: string | null;
};

export type SessionDetail = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  publishedAt: string | null;
  fieldLabel: string | null;
  groupIds: string[];
  groupNames: string[];
  roster: SessionRosterEntry[];
};

/** Lista os eventos da organização com o resumo de RSVP. */
export async function listSessions(): Promise<SessionListItem[]> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data } = await db
    .from('sessions')
    .select('id, title, event_type, starts_at, ends_at, status, published_at')
    .eq('organization_id', ctx.orgId)
    .order('starts_at', { ascending: true })
    .limit(200);

  const sessions = (data ?? []) as {
    id: string;
    title: string;
    event_type: string;
    starts_at: string;
    ends_at: string;
    status: string;
    published_at: string | null;
  }[];

  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);

  const [{ data: groupRows }, { data: attRows }] = await Promise.all([
    db.from('session_groups').select('session_id, groups(name)').in('session_id', ids),
    db.from('session_attendance').select('session_id, status').in('session_id', ids),
  ]);

  const namesBySession = new Map<string, string[]>();
  for (const r of (groupRows ?? []) as unknown as {
    session_id: string;
    groups: { name: string } | null;
  }[]) {
    if (!r.groups) continue;
    const list = namesBySession.get(r.session_id) ?? [];
    list.push(r.groups.name);
    namesBySession.set(r.session_id, list);
  }

  const tally = new Map<string, { going: number; notGoing: number; noReply: number }>();
  for (const r of (attRows ?? []) as { session_id: string; status: string }[]) {
    const cur = tally.get(r.session_id) ?? { going: 0, notGoing: 0, noReply: 0 };
    if (r.status === 'confirmed' || r.status === 'present' || r.status === 'late') cur.going += 1;
    else if (['declined', 'absent', 'excused', 'no_show'].includes(r.status)) cur.notGoing += 1;
    else cur.noReply += 1;
    tally.set(r.session_id, cur);
  }

  return sessions.map((s) => {
    const t = tally.get(s.id) ?? { going: 0, notGoing: 0, noReply: 0 };
    return {
      id: s.id,
      title: s.title,
      eventType: s.event_type,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      status: s.status,
      publishedAt: s.published_at,
      groupNames: namesBySession.get(s.id) ?? [],
      ...t,
    };
  });
}

export async function getSession(sessionId: string): Promise<SessionDetail | null> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data } = await db
    .from('sessions')
    .select(
      'id, title, description, event_type, starts_at, ends_at, status, published_at, field_label',
    )
    .eq('id', sessionId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle();

  if (!data) return null;
  const s = data as {
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    starts_at: string;
    ends_at: string;
    status: string;
    published_at: string | null;
    field_label: string | null;
  };

  const { data: groupRows } = await db
    .from('session_groups')
    .select('group_id, groups(name)')
    .eq('session_id', sessionId);

  const groups = (groupRows ?? []) as unknown as {
    group_id: string;
    groups: { name: string } | null;
  }[];

  const { data: attRows } = await db
    .from('session_attendance')
    .select('athlete_id, status, responded_at, athletes(first_name, last_name)')
    .eq('session_id', sessionId);

  const roster = ((attRows ?? []) as unknown as {
    athlete_id: string;
    status: string;
    responded_at: string | null;
    athletes: { first_name: string; last_name: string } | null;
  }[]).map((a) => ({
    athleteId: a.athlete_id,
    name: a.athletes ? `${a.athletes.first_name} ${a.athletes.last_name}` : '—',
    status: a.status,
    respondedAt: a.responded_at,
  }));

  roster.sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: s.id,
    title: s.title,
    description: s.description,
    eventType: s.event_type,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    status: s.status,
    publishedAt: s.published_at,
    fieldLabel: s.field_label,
    groupIds: groups.map((g) => g.group_id),
    groupNames: groups.map((g) => g.groups?.name ?? '—'),
    roster,
  };
}

/** Cria um evento associado a UM OU MAIS grupos (brief §8/§13). */
export async function createSession(input: {
  title: string;
  description?: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  fieldLabel?: string;
  groupIds: string[];
  includeSubgroups?: boolean;
}): Promise<CreateResult> {
  const ctx = await requireRole([...EDITORS]);
  const db = await getDb();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'title_required' };
  if (input.groupIds.length === 0) return { ok: false, error: 'groups_required' };
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return { ok: false, error: 'invalid_time_range' };
  }

  const { data, error } = await db
    .from('sessions')
    .insert({
      organization_id: ctx.orgId,
      title,
      description: input.description?.trim() || null,
      event_type: input.eventType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      field_label: input.fieldLabel?.trim() || null,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'create_failed' };
  const sessionId = (data as { id: string }).id;

  const { error: linkError } = await db.from('session_groups').insert(
    input.groupIds.map((groupId) => ({
      session_id: sessionId,
      group_id: groupId,
      include_subgroups: input.includeSubgroups ?? false,
    })),
  );

  if (linkError) return { ok: false, error: linkError.message };

  revalidatePath('/coach/schedule');
  return { ok: true, id: sessionId };
}

/** Publica: materializa os convites de RSVP para todos os atletas dos grupos. */
export async function publishSession(sessionId: string): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const db = await getDb();

  const { error } = await db.rpc('publish_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/schedule');
  revalidatePath(`/coach/schedule/${sessionId}`);
  return { ok: true };
}

export async function cancelSession(sessionId: string, reason: string): Promise<ActionResult> {
  const ctx = await requireRole([...EDITORS]);
  const db = await getDb();

  const { error } = await db
    .from('sessions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_by: ctx.userId,
      cancellation_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/schedule');
  revalidatePath(`/coach/schedule/${sessionId}`);
  return { ok: true };
}

export async function deleteSession(sessionId: string): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const db = await getDb();

  const { error } = await db.from('sessions').delete().eq('id', sessionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/schedule');
  return { ok: true };
}

/** Chamada do coach: marca presença/falta de um atleta. */
export async function markAttendance(
  sessionId: string,
  athleteId: string,
  status: string,
): Promise<ActionResult> {
  const ctx = await requireRole([...EDITORS]);
  const db = await getDb();

  const isCheckIn = ['present', 'late'].includes(status);

  const { error } = await db
    .from('session_attendance')
    .update({
      status,
      checked_in_at: isCheckIn ? new Date().toISOString() : null,
      checked_in_by: isCheckIn ? ctx.userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('athlete_id', athleteId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/coach/schedule/${sessionId}`);
  return { ok: true };
}
