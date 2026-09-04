import { createServiceClient } from '@/lib/supabase/service';

const PREVIEW_TTL_SECONDS = 60 * 60; // 1h — tempo de sobra para ler o aviso

type SignableFile = {
  id: string;
  mime_type: string;
  storage_path: string;
};

/**
 * Gera URLs assinadas para os anexos que são IMAGEM, para que apareçam
 * direto no aviso. O bucket é privado, então cada imagem precisa da própria
 * URL temporária. PDFs ficam de fora — são abertos sob demanda.
 */
export async function signImagePreviews(
  files: readonly SignableFile[],
): Promise<Map<string, string>> {
  const images = files.filter((f) => f.mime_type.startsWith('image/'));
  const out = new Map<string, string>();
  if (images.length === 0) return out;

  const svc = createServiceClient();
  const { data } = await svc.storage
    .from('announcements')
    .createSignedUrls(
      images.map((f) => f.storage_path),
      PREVIEW_TTL_SECONDS,
    );

  // createSignedUrls devolve na mesma ordem dos caminhos enviados.
  (data ?? []).forEach((entry, index) => {
    const file = images[index];
    if (file && entry?.signedUrl) out.set(file.id, entry.signedUrl);
  });

  return out;
}
