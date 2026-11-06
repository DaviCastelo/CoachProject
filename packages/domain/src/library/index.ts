/**
 * Regras da biblioteca que não dependem de banco nem de navegador: que tipos
 * entram, quando vale comprimir e como reconhecer um link.
 *
 * A lista de tipos é uma cópia consciente de `allowed_mime_types` do bucket
 * `library`. Quem recusa de verdade é o bucket; esta aqui existe para recusar
 * antes de enviar, com uma mensagem que explica o motivo.
 */

export type LibraryFileKind = 'image' | 'video' | 'pdf' | 'document' | 'link';
export type LibraryStoredKind = Exclude<LibraryFileKind, 'link'>;

const TYPES: readonly { mime: string; kind: LibraryStoredKind; extensions: readonly string[] }[] = [
  { mime: 'image/jpeg', kind: 'image', extensions: ['jpg', 'jpeg'] },
  { mime: 'image/png', kind: 'image', extensions: ['png'] },
  { mime: 'image/webp', kind: 'image', extensions: ['webp'] },
  { mime: 'image/gif', kind: 'image', extensions: ['gif'] },
  { mime: 'image/heic', kind: 'image', extensions: ['heic'] },
  { mime: 'image/heif', kind: 'image', extensions: ['heif'] },
  { mime: 'image/avif', kind: 'image', extensions: ['avif'] },
  { mime: 'video/mp4', kind: 'video', extensions: ['mp4'] },
  { mime: 'video/quicktime', kind: 'video', extensions: ['mov'] },
  { mime: 'video/webm', kind: 'video', extensions: ['webm'] },
  { mime: 'video/x-m4v', kind: 'video', extensions: ['m4v'] },
  { mime: 'application/pdf', kind: 'pdf', extensions: ['pdf'] },
  { mime: 'application/msword', kind: 'document', extensions: ['doc'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'document',
    extensions: ['docx'],
  },
  { mime: 'application/vnd.ms-excel', kind: 'document', extensions: ['xls'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    kind: 'document',
    extensions: ['xlsx'],
  },
  { mime: 'application/vnd.ms-powerpoint', kind: 'document', extensions: ['ppt'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    kind: 'document',
    extensions: ['pptx'],
  },
  { mime: 'text/plain', kind: 'document', extensions: ['txt'] },
  { mime: 'text/csv', kind: 'document', extensions: ['csv'] },
];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Descobre o tipo pelo MIME e, sem ele, pela extensão. Alguns sistemas mandam
 * `file.type` vazio para `.mov` e `.heic`. Devolve `null` para o que não entra:
 * SVG e HTML ficam de fora de propósito, porque rodam script ao abrir.
 */
export function resolveLibraryType(file: {
  name: string;
  type: string;
}): { kind: LibraryStoredKind; mime: string } | null {
  const mime = file.type.split(';')[0].trim().toLowerCase();
  const extension = extensionOf(file.name);
  const found =
    TYPES.find((t) => t.mime === mime) ??
    (mime === '' || mime === 'application/octet-stream'
      ? TYPES.find((t) => t.extensions.includes(extension))
      : undefined);
  return found ? { kind: found.kind, mime: found.mime } : null;
}

/** O que o seletor de arquivos oferece. */
export const LIBRARY_ACCEPT = TYPES.flatMap((t) => t.extensions.map((e) => `.${e}`)).join(',');

const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Foto de celular passa de 4 MB. Abaixo disso a recompressão pouco ganha. */
const COMPRESS_ABOVE_BYTES = 700 * 1024;

/** GIF perderia a animação; HEIC o Chrome nem sabe abrir. */
export function shouldCompressImage(mime: string, sizeBytes: number): boolean {
  return COMPRESSIBLE.has(mime) && sizeBytes > COMPRESS_ABOVE_BYTES;
}

/** Medidas finais mantendo a proporção, sem nunca ampliar. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function withExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.${extension}`;
}

export type LibraryLink = { url: string; youtubeId: string | null };

const YOUTUBE_ID = /^[\w-]{6,20}$/;

function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m)\./, '').toLowerCase();
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com') {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') id = url.searchParams.get('v');
    else if (first === 'shorts' || first === 'embed' || first === 'live') id = second ?? null;
  }

  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Só https: `javascript:` num link clicável executaria dentro do painel. */
export function parseLibraryLink(raw: string): LibraryLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return { url: url.toString(), youtubeId: youtubeIdFrom(url) };
}

export function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`;
}
