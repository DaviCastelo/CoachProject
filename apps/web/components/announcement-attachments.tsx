'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Paperclip, FileText, ImageOff } from 'lucide-react';

export type AttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  previewUrl?: string | null;
};

type Props = Readonly<{
  attachments: readonly AttachmentView[];
  /** Abre o arquivo (usado para PDF e como fallback da imagem). */
  onOpen: (id: string) => void;
}>;

/**
 * Imagens aparecem direto no aviso (clique amplia); PDFs viram um item
 * clicável. O bucket é privado, então a imagem usa URL assinada.
 */
export function AnnouncementAttachments({ attachments, onOpen }: Props) {
  const t = useTranslations('common');
  const [broken, setBroken] = useState<Set<string>>(new Set());

  if (attachments.length === 0) return null;

  const images = attachments.filter((f) => f.mimeType.startsWith('image/'));
  const others = attachments.filter((f) => !f.mimeType.startsWith('image/'));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        {t('attachments')}
      </p>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((f) =>
            f.previewUrl && !broken.has(f.id) ? (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpen(f.id)}
                title={f.fileName}
                className="group relative aspect-video overflow-hidden rounded-md border border-input transition-colors hover:border-accent-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.previewUrl}
                  alt={f.fileName}
                  loading="lazy"
                  onError={() => setBroken((prev) => new Set(prev).add(f.id))}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ) : (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpen(f.id)}
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-md border border-input px-2 text-xs text-muted-foreground transition-colors hover:border-accent-500"
              >
                <ImageOff className="h-4 w-4" />
                <span className="line-clamp-2 text-center">{f.fileName}</span>
              </button>
            ),
          )}
        </div>
      ) : null}

      {others.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(f.id)}
          className="flex w-full items-center gap-2 rounded-md border border-input px-2 py-1.5 text-left text-sm transition-colors hover:border-accent-500"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{f.fileName}</span>
        </button>
      ))}
    </div>
  );
}
