'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { signImagePreviews } from '@/lib/announcements/preview';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SendResult = { ok: true; recipients: number } | { ok: false; error: string };

async function getDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const STAFF = ['owner', 'admin', 'coach', 'staff'] as const;
const SENDERS = ['owner', 'admin', 'coach'] as const;

export type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** URL assinada (1h) — só para imagens, que aparecem inline no aviso. */
  previewUrl: string | null;
};

export type AnnouncementListItem = {
  id: string;
  title: string;
  body: string;
  status: string;
  sentAt: string | null;
  groupNames: string[];
  recipientCount: number;
  readCount: number;
  attachments: Attachment[];
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

  const [{ data: groupRows }, { data: recipientRows }, { data: attachmentRows }] =
    await Promise.all([
      db
        .from('announcement_groups')
        .select('announcement_id, groups(name)')
        .in('announcement_id', ids),
      db
        .from('announcement_recipients')
        .select('announcement_id, read_at')
        .in('announcement_id', ids),
      db
        .from('announcement_attachments')
        .select('id, announcement_id, file_name, mime_type, size_bytes, storage_path')
        .in('announcement_id', ids),
    ]);

  const attachmentFiles = (attachmentRows ?? []) as {
    id: string;
    announcement_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
  }[];

  const previews = await signImagePreviews(attachmentFiles);

  const attachmentsById = new Map<string, Attachment[]>();
  for (const f of attachmentFiles) {
    const list = attachmentsById.get(f.announcement_id) ?? [];
    list.push({
      id: f.id,
      fileName: f.file_name,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      previewUrl: previews.get(f.id) ?? null,
    });
    attachmentsById.set(f.announcement_id, list);
  }

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
      attachments: attachmentsById.get(r.id) ?? [],
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

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/**
 * Envia um aviso para UM grupo, com anexos opcionais (imagem/PDF).
 * Recebe FormData porque carrega arquivos.
 */
export async function sendGroupAnnouncement(formData: FormData): Promise<SendResult> {
  const ctx = await requireRole([...SENDERS]);
  const db = await getDb();

  const groupId = String(formData.get('groupId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const includeSubgroups = formData.get('includeSubgroups') === 'true';

  if (!groupId) return { ok: false, error: 'groups_required' };
  if (!title || !body) return { ok: false, error: 'title_and_body_required' };

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'file_too_large' };
    if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: 'file_type_not_allowed' };
  }

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

  const { error: linkError } = await db.from('announcement_groups').insert({
    announcement_id: announcementId,
    group_id: groupId,
    include_subgroups: includeSubgroups,
  });
  if (linkError) return { ok: false, error: linkError.message };

  // Anexos vão para o bucket privado; a leitura acontece por URL assinada.
  if (files.length > 0) {
    const svc = createServiceClient();
    for (const file of files) {
      const safeName = file.name.replace(/[^\w.\-]/g, '_').slice(0, 120);
      const path = `${ctx.orgId}/${announcementId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await svc.storage
        .from('announcements')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) return { ok: false, error: uploadError.message };

      const { error: rowError } = await svc.from('announcement_attachments').insert({
        announcement_id: announcementId,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (rowError) return { ok: false, error: rowError.message };
    }
  }

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
  revalidatePath(`/coach/groups/${groupId}`);
  return { ok: true, recipients: typeof sent === 'number' ? sent : 0 };
}

/** URL assinada (5 min) para baixar/ver um anexo. */
export async function getAttachmentUrl(attachmentId: string): Promise<string | null> {
  const db = await getDb();

  // A RLS de announcement_attachments já garante que só quem pode ver o aviso lê.
  const { data } = await db
    .from('announcement_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();

  const path = (data as { storage_path: string } | null)?.storage_path;
  if (!path) return null;

  const svc = createServiceClient();
  const { data: signed } = await svc.storage.from('announcements').createSignedUrl(path, 300);
  return signed?.signedUrl ?? null;
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireRole([...SENDERS]);
  const db = await getDb();

  const { error } = await db.from('announcements').delete().eq('id', id).eq('status', 'draft');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/coach/announcements');
  return { ok: true };
}
