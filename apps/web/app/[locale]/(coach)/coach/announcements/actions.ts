'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SendResult = { ok: true; recipients: number } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const STAFF = ['owner', 'admin', 'coach', 'staff'] as const;
const SENDERS = ['owner', 'admin', 'coach'] as const;

export type AnnouncementListItem = {
  id: string;
  title: string;
  body: string;
  status: string;
  sentAt: string | null;
  groupNames: string[];
  recipientCount: number;
  readCount: number;
};

export async function listAnnouncements(): Promise<AnnouncementListItem[]> {
  const ctx = await requireRole([...STAFF]);
  const db = await getDb();

  const { data } = await db
    .from('announcements')
    .select('id, title, body, status, sent_at')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as {
    id: string;
    title: string;
    body: string;
    status: string;
    sent_at: string | null;
  }[];

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [{ data: groupRows }, { data: recipientRows }] = await Promise.all([
    db.from('announcement_groups').select('announcement_id, groups(name)').in('announcement_id', ids),
    db.from('announcement_recipients').select('announcement_id, read_at').in('announcement_id', ids),
  ]);

  const namesById = new Map<string, string[]>();
  for (const g of (groupRows ?? []) as unknown as {
    announcement_id: string;
    groups: { name: string } | null;
  }[]) {
    if (!g.groups) continue;
    const list = namesById.get(g.announcement_id) ?? [];
    list.push(g.groups.name);
    namesById.set(g.announcement_id, list);
  }

  const counts = new Map<string, { total: number; read: number }>();
  for (const r of (recipientRows ?? []) as { announcement_id: string; read_at: string | null }[]) {
    const cur = counts.get(r.announcement_id) ?? { total: 0, read: 0 };
    cur.total += 1;
    if (r.read_at) cur.read += 1;
    counts.set(r.announcement_id, cur);
  }

  return rows.map((r) => {
    const c = counts.get(r.id) ?? { total: 0, read: 0 };
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      status: r.status,
      sentAt: r.sent_at,
      groupNames: namesById.get(r.id) ?? [],
      recipientCount: c.total,
      readCount: c.read,
    };
  });
}

/**
 * Cria e envia o anúncio. O envio materializa os destinatários via RPC:
 * atletas com conta + responsáveis que aceitam comunicação + coaches dos grupos.
 */
export async function createAndSendAnnouncement(input: {
  title: string;
  body: string;
  groupIds: string[];
  includeSubgroups?: boolean;
}): Promise<SendResult> {
  const ctx = await requireRole([...SENDERS]);
  const db = await getDb();

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: 'title_and_body_required' };
  if (input.groupIds.length === 0) return { ok: false, error: 'groups_required' };

  const { data, error } = await db
    .from('announcements')
    .insert({
      organization_id: ctx.orgId,
      author_id: ctx.userId,
      title,
      body,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'create_failed' };
  const announcementId = (data as { id: string }).id;

  const { error: linkError } = await db.from('announcement_groups').insert(
    input.groupIds.map((groupId) => ({
      announcement_id: announcementId,
      group_id: groupId,
      include_subgroups: input.includeSubgroups ?? false,
    })),
  );
  if (linkError) return { ok: false, error: linkError.message };

  const { data: sent, error: sendError } = await db.rpc('send_announcement', {
    p_announcement_id: announcementId,
  });

  if (sendError) {
    return {
      ok: false,
      error: sendError.message.includes('group_not_owned') ? 'group_not_owned' : sendError.message,
    };
  }

  revalidatePath('/coach/announcements');
  return { ok: true, recipients: typeof sent === 'number' ? sent : 0 };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireRole([...SENDERS]);
  const db = await getDb();

  const { error } = await db.from('announcements').delete().eq('id', id).eq('status', 'draft');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/announcements');
  return { ok: true };
}
