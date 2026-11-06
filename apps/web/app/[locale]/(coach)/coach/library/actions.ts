'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseLibraryLink,
  resolveLibraryType,
  type LibraryFileKind,
} from '@ca-tempo/domain';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { purgeDeletedFiles } from '@/lib/library/purge';

const BUCKET = 'library';
const STAFF = ['owner', 'admin', 'coach', 'staff'] as const;

/** Miniatura aparece em lista; uma hora cobre uma sessão de uso sem pesar. */
const THUMB_URL_SECONDS = 3600;
const FILE_URL_SECONDS = 3600;

/** Cada pasta abre com isto no máximo: a tela nunca baixa a biblioteca inteira. */
const PAGE_SIZE = 200;

export type LibraryErrorCode =
  | 'forbidden'
  | 'invalid_name'
  | 'invalid_url'
  | 'invalid_type'
  | 'folder_name_taken'
  | 'folder_too_deep'
  | 'folder_cycle'
  | 'folder_not_found'
  | 'file_not_found'
  | 'file_too_large'
  | 'quota_exceeded'
  | 'upload_failed'
  | 'unknown';

export type LibraryResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: LibraryErrorCode };

export type LibraryFolder = { id: string; name: string; parentId: string | null };

export type LibraryFile = {
  id: string;
  name: string;
  kind: LibraryFileKind;
  mimeType: string | null;
  sizeBytes: number;
  externalUrl: string | null;
  thumbUrl: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type LibraryView = {
  orgId: string;
  folderId: string | null;
  path: { id: string; name: string }[];
  folders: LibraryFolder[];
  allFolders: LibraryFolder[];
  files: LibraryFile[];
  truncated: boolean;
  canManage: boolean;
  usedBytes: number;
  quotaBytes: number;
  maxFileBytes: number;
};

async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

const KNOWN_ERRORS: readonly LibraryErrorCode[] = [
  'forbidden',
  'invalid_name',
  'invalid_url',
  'folder_name_taken',
  'folder_too_deep',
  'folder_cycle',
  'folder_not_found',
  'file_not_found',
  'file_too_large',
  'quota_exceeded',
];

function errorCode(message: string | undefined): LibraryErrorCode {
  return KNOWN_ERRORS.find((code) => message?.includes(code)) ?? 'unknown';
}

function refresh(): void {
  revalidatePath('/[locale]/coach/library', 'page');
}

type FileRow = {
  id: string;
  name: string;
  kind: LibraryFileKind;
  mime_type: string | null;
  size_bytes: number;
  external_url: string | null;
  thumb_key: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export async function loadLibrary(folderId: string | null): Promise<LibraryView | null> {
  const ctx = await requireRole([...STAFF]);
  const sb = await db();

  const folderFilter = sb
    .from('library_files')
    .select('id, name, kind, mime_type, size_bytes, external_url, thumb_key, uploaded_by, created_at')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  const [{ data: folderRows }, { data: fileRows }, { data: usage }, { data: path }] =
    await Promise.all([
      sb
        .from('library_folders')
        .select('id, name, parent_id')
        .eq('organization_id', ctx.orgId)
        .order('name', { ascending: true }),
      folderId ? folderFilter.eq('folder_id', folderId) : folderFilter.is('folder_id', null),
      sb.rpc('library_usage', { p_org: ctx.orgId }),
      folderId ? sb.rpc('library_folder_path', { p_folder: folderId }) : Promise.resolve({ data: [] }),
    ]);

  const allFolders: LibraryFolder[] = (
    (folderRows ?? []) as { id: string; name: string; parent_id: string | null }[]
  ).map((f) => ({ id: f.id, name: f.name, parentId: f.parent_id }));

  if (folderId && !allFolders.some((f) => f.id === folderId)) return null;

  const rows = (fileRows ?? []) as FileRow[];
  const truncated = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);

  // Uma ida ao Storage para a pasta inteira, e só de miniaturas de alguns KB.
  // O arquivo em si só é assinado quando alguém abre.
  const thumbKeys = visible.map((r) => r.thumb_key).filter((k): k is string => !!k);
  const thumbs = new Map<string, string>();
  if (thumbKeys.length > 0) {
    const { data: signed } = await createServiceClient()
      .storage.from(BUCKET)
      .createSignedUrls(thumbKeys, THUMB_URL_SECONDS);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) thumbs.set(item.path, item.signedUrl);
    }
  }

  const canManage = ctx.role === 'owner' || ctx.role === 'admin';
  const limits = usage as { used_bytes: number; quota_bytes: number; max_file_bytes: number } | null;

  return {
    orgId: ctx.orgId,
    folderId,
    path: (path ?? []) as { id: string; name: string }[],
    folders: allFolders.filter((f) => f.parentId === folderId),
    allFolders,
    files: visible.map((r) => {
      const link = r.external_url ? parseLibraryLink(r.external_url) : null;
      return {
        id: r.id,
        name: r.name,
        kind: r.kind,
        mimeType: r.mime_type,
        sizeBytes: r.size_bytes,
        externalUrl: r.external_url,
        thumbUrl: link?.youtubeId
          ? `https://i.ytimg.com/vi/${link.youtubeId}/mqdefault.jpg`
          : r.thumb_key
            ? (thumbs.get(r.thumb_key) ?? null)
            : null,
        createdAt: r.created_at,
        canDelete: canManage || r.uploaded_by === ctx.userId,
      };
    }),
    truncated,
    canManage,
    usedBytes: limits?.used_bytes ?? 0,
    quotaBytes: limits?.quota_bytes ?? 0,
    maxFileBytes: limits?.max_file_bytes ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

export async function createFolder(parentId: string | null, name: string): Promise<LibraryResult> {
  const ctx = await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_create_folder', {
    p_org: ctx.orgId,
    p_parent: parentId,
    p_name: name,
  });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function renameFolder(id: string, name: string): Promise<LibraryResult> {
  await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_rename_folder', { p_folder: id, p_name: name });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function moveFolder(id: string, parentId: string | null): Promise<LibraryResult> {
  await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_move_folder', {
    p_folder: id,
    p_parent: parentId,
  });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function deleteFolder(id: string): Promise<LibraryResult> {
  const ctx = await requireRole(['owner', 'admin']);
  const { error } = await (await db()).rpc('library_delete_folder', { p_folder: id });
  if (error) return { ok: false, error: errorCode(error.message) };
  await purgeDeletedFiles(ctx.orgId);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

export type UploadTicket = {
  fileId: string;
  storageKey: string;
  token: string;
  mime: string;
  thumb: { path: string; token: string } | null;
};

/**
 * Reserva a cota e devolve o token de envio. O arquivo vai do navegador direto
 * para o Storage: passar pela Vercel esbarraria no limite de corpo da função e
 * ainda pagaria o tráfego duas vezes.
 */
export async function startUpload(input: {
  folderId: string | null;
  name: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  hasThumb: boolean;
}): Promise<LibraryResult<UploadTicket>> {
  const ctx = await requireRole([...STAFF]);

  const resolved = resolveLibraryType({ name: input.name, type: input.type });
  if (!resolved) return { ok: false, error: 'invalid_type' };

  const { data, error } = await (await db()).rpc('library_begin_upload', {
    p_org: ctx.orgId,
    p_folder: input.folderId,
    p_name: input.name.slice(0, 200),
    p_kind: resolved.kind,
    p_mime: resolved.mime,
    p_size: input.size,
    p_width: input.width,
    p_height: input.height,
    p_duration: input.duration,
    p_has_thumb: input.hasThumb,
  });
  if (error || !data) return { ok: false, error: errorCode(error?.message) };

  const row = data as { id: string; storage_key: string; thumb_key: string | null };
  const storage = createServiceClient().storage.from(BUCKET);

  const [{ data: main }, thumbResult] = await Promise.all([
    storage.createSignedUploadUrl(row.storage_key),
    row.thumb_key ? storage.createSignedUploadUrl(row.thumb_key) : Promise.resolve(null),
  ]);

  if (!main) {
    await abortUpload(row.id);
    return { ok: false, error: 'upload_failed' };
  }

  return {
    ok: true,
    data: {
      fileId: row.id,
      storageKey: row.storage_key,
      token: main.token,
      mime: resolved.mime,
      thumb:
        row.thumb_key && thumbResult?.data
          ? { path: row.thumb_key, token: thumbResult.data.token }
          : null,
    },
  };
}

export async function finishUpload(fileId: string): Promise<LibraryResult> {
  await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_finish_upload', { p_file: fileId });
  if (error) {
    await abortUpload(fileId);
    return { ok: false, error: 'upload_failed' };
  }
  refresh();
  return { ok: true };
}

/** Cancelado ou com falha: devolve a cota na hora, sem esperar o cron. */
export async function abortUpload(fileId: string): Promise<LibraryResult> {
  const ctx = await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_delete_file', { p_file: fileId });
  if (error) return { ok: false, error: errorCode(error.message) };
  await purgeDeletedFiles(ctx.orgId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

export async function addLink(
  folderId: string | null,
  name: string,
  rawUrl: string,
): Promise<LibraryResult> {
  const ctx = await requireRole([...STAFF]);
  const link = parseLibraryLink(rawUrl);
  if (!link) return { ok: false, error: 'invalid_url' };

  const { error } = await (await db()).rpc('library_add_link', {
    p_org: ctx.orgId,
    p_folder: folderId,
    p_name: name.slice(0, 200),
    p_url: link.url,
  });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function renameFile(id: string, name: string): Promise<LibraryResult> {
  await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_rename_file', { p_file: id, p_name: name });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function moveFile(id: string, folderId: string | null): Promise<LibraryResult> {
  await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_move_file', {
    p_file: id,
    p_folder: folderId,
  });
  if (error) return { ok: false, error: errorCode(error.message) };
  refresh();
  return { ok: true };
}

export async function deleteFile(id: string): Promise<LibraryResult> {
  const ctx = await requireRole([...STAFF]);
  const { error } = await (await db()).rpc('library_delete_file', { p_file: id });
  if (error) return { ok: false, error: errorCode(error.message) };
  await purgeDeletedFiles(ctx.orgId);
  refresh();
  return { ok: true };
}

/**
 * URL assinada de um arquivo, gerada só quando alguém abre. Quem chama passa
 * pela RLS na leitura da linha, então não dá para pedir o arquivo de outra
 * organização adivinhando o id.
 */
export async function getFileUrl(
  id: string,
  mode: 'view' | 'download',
): Promise<LibraryResult<{ url: string }>> {
  await requireRole([...STAFF]);
  const { data } = await (await db())
    .from('library_files')
    .select('name, storage_key')
    .eq('id', id)
    .eq('status', 'ready')
    .maybeSingle();

  const row = data as { name: string; storage_key: string | null } | null;
  if (!row?.storage_key) return { ok: false, error: 'file_not_found' };

  const { data: signed } = await createServiceClient()
    .storage.from(BUCKET)
    .createSignedUrl(
      row.storage_key,
      FILE_URL_SECONDS,
      mode === 'download' ? { download: row.name } : undefined,
    );

  if (!signed?.signedUrl) return { ok: false, error: 'unknown' };
  return { ok: true, data: { url: signed.signedUrl } };
}
