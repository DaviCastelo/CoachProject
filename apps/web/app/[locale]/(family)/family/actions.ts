'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { signImagePreviews } from '@/lib/announcements/preview';

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

export type FamilyGroup = {
  id: string;
  name: string;
  ageGroup: string | null;
  athleteName: string;
  teammates: string[];
  coaches: string[];
};

/**
 * Grupos dos atletas do usuário, com os companheiros de time.
 * A RLS garante que só aparecem os grupos em que ele (ou o filho) está.
 */
export async function listFamilyGroups(): Promise<FamilyGroup[]> {
  const db = await getDb();

  const { data: athleteRows } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .is('deleted_at', null);

  const athletes = ((athleteRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
  }[]).map((a) => ({ id: a.id, name: `${a.first_name} ${a.last_name}` }));

  if (athletes.length === 0) return [];
  const myAthleteIds = new Set(athletes.map((a) => a.id));
  const nameById = new Map(athletes.map((a) => [a.id, a.name]));

  // Participações próprias (a RLS family_read limita aos próprios atletas).
  const { data: myMemberships } = await db
    .from('group_members')
    .select('group_id, athlete_id, groups(id, name, age_group)')
    .is('left_at', null);

  const mine = (myMemberships ?? []) as unknown as {
    group_id: string;
    athlete_id: string;
    groups: { id: string; name: string; age_group: string | null } | null;
  }[];

  if (mine.length === 0) return [];

  // Companheiros e coaches vêm de RPCs SECURITY DEFINER: a RLS de `athletes`
  // limita a família aos próprios atletas (e a linha carrega dados médicos),
  // então as funções devolvem só o nome de quem está no mesmo grupo.
  const [{ data: teammateRows }, { data: coachRows }] = await Promise.all([
    db.rpc('list_my_teammates'),
    db.rpc('list_my_group_coaches'),
  ]);

  const teammatesByGroup = new Map<string, string[]>();
  for (const m of (teammateRows ?? []) as {
    group_id: string;
    athlete_id: string;
    full_name: string;
  }[]) {
    if (myAthleteIds.has(m.athlete_id)) continue; // não se lista como próprio colega
    const list = teammatesByGroup.get(m.group_id) ?? [];
    list.push(m.full_name);
    teammatesByGroup.set(m.group_id, list);
  }

  const coachesByGroup = new Map<string, string[]>();
  for (const c of (coachRows ?? []) as { group_id: string; full_name: string | null }[]) {
    const list = coachesByGroup.get(c.group_id) ?? [];
    if (c.full_name) list.push(c.full_name);
    coachesByGroup.set(c.group_id, list);
  }

  return mine
    .filter((m) => m.groups !== null)
    .map((m) => ({
      id: m.group_id,
      name: m.groups?.name ?? '—',
      ageGroup: m.groups?.age_group ?? null,
      athleteName: nameById.get(m.athlete_id) ?? '',
      teammates: (teammatesByGroup.get(m.group_id) ?? []).sort((a, b) => a.localeCompare(b)),
      coaches: coachesByGroup.get(m.group_id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type AnnouncementFile = {
  id: string;
  fileName: string;
  mimeType: string;
  /** URL assinada (1h) — preenchida só para imagens, que aparecem inline. */
  previewUrl: string | null;
};

export type FamilyAnnouncement = {
  id: string;
  title: string;
  body: string;
  sentAt: string | null;
  readAt: string | null;
  attachments: AnnouncementFile[];
};

/** Anúncios recebidos pelo usuário (materializados no envio). */
export async function listFamilyAnnouncements(): Promise<FamilyAnnouncement[]> {
  const db = await getDb();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  // Só chegam os avisos em que o usuário é destinatário — ou seja, dos grupos
  // a que ele (ou o filho) pertence no momento do envio.
  const { data } = await db
    .from('announcement_recipients')
    .select('announcement_id, read_at, announcements(title, body, sent_at)')
    .eq('profile_id', user.id)
    .limit(100);

  const rows = ((data ?? []) as unknown as {
    announcement_id: string;
    read_at: string | null;
    announcements: { title: string; body: string; sent_at: string | null } | null;
  }[]).filter((r) => r.announcements !== null);

  const ids = rows.map((r) => r.announcement_id);
  const filesById = new Map<string, AnnouncementFile[]>();
  if (ids.length > 0) {
    const { data: fileRows } = await db
      .from('announcement_attachments')
      .select('id, announcement_id, file_name, mime_type, storage_path')
      .in('announcement_id', ids);

    const files = (fileRows ?? []) as {
      id: string;
      announcement_id: string;
      file_name: string;
      mime_type: string;
      storage_path: string;
    }[];

    // Imagens ganham URL assinada para aparecerem direto no aviso.
    const previews = await signImagePreviews(files);

    for (const f of files) {
      const list = filesById.get(f.announcement_id) ?? [];
      list.push({
        id: f.id,
        fileName: f.file_name,
        mimeType: f.mime_type,
        previewUrl: previews.get(f.id) ?? null,
      });
      filesById.set(f.announcement_id, list);
    }
  }

  return rows
    .map((r) => ({
      id: r.announcement_id,
      title: r.announcements?.title ?? '',
      body: r.announcements?.body ?? '',
      sentAt: r.announcements?.sent_at ?? null,
      readAt: r.read_at,
      attachments: filesById.get(r.announcement_id) ?? [],
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
