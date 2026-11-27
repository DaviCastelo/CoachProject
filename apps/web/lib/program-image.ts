const GALLERY_IMAGES = [
  '/images/gallery-1.webp',
  '/images/gallery-2.webp',
  '/images/gallery-3.webp',
  '/images/gallery-4.webp',
] as const;

/** Fallback estável por slug — o mesmo programa sempre leva a mesma foto. */
export function programImageForSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    const code = slug.codePointAt(i) ?? 0;
    h = (h + code) % GALLERY_IMAGES.length;
    if (code > 0xffff) i++;
  }
  return GALLERY_IMAGES[h];
}

/*
 * `programs.hero_image_url` existe desde a primeira migração do schema e
 * nenhum lugar do app lia ou escrevia nela: todo programa caía no sorteio
 * entre quatro fotos de banco. Como o sorteio é a soma dos códigos dos
 * caracteres do slug, dois programas de nome parecido ainda por cima saíam
 * com a mesma foto.
 */
export function programImage(program: {
  slug: string;
  hero_image_url?: string | null;
}): string {
  return ownProgramImage(program) ?? programImageForSlug(program.slug);
}

/*
 * Só a imagem que o próprio programa cadastrou, sem o sorteio.
 *
 * Na página do programa e na de inscrição ela aparece inteira, nunca como
 * fundo de banner: o caso comum é flyer em retrato, cheio de texto, e um
 * `object-cover` num banner deitado corta justo as datas e os preços.
 */
export function ownProgramImage(program: { hero_image_url?: string | null }): string | null {
  const own = program.hero_image_url?.trim();
  return own || null;
}

/*
 * `og:image` com caminho relativo não vira preview: o WhatsApp e os outros
 * leitores de link não resolvem `/images/...` contra o site. Sem endereço
 * absoluto, melhor não declarar imagem nenhuma.
 */
export function absoluteImageUrl(src: string, siteUrl: string | undefined): string | null {
  if (src.startsWith('https://')) return src;
  if (!siteUrl) return null;
  try {
    return new URL(src, siteUrl).toString();
  } catch {
    return null;
  }
}

/*
 * O que a coluna aceita.
 *
 * A CSP da aplicação libera `img-src 'self' data: blob: https://*.supabase.co`
 * e o otimizador do Next só busca host declarado em `remotePatterns`. Uma URL
 * fora disso não estoura erro em lugar nenhum: a foto simplesmente não
 * aparece, e quem cadastrou nunca fica sabendo. Por isso a recusa é na
 * gravação, com o motivo escrito.
 */
export function parseProgramImageUrl(
  raw: string,
  supabaseUrl: string | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };

  // Caminho do próprio site: o que está em `apps/web/public/images/`.
  if (value.startsWith('/images/')) {
    if (value.includes('..')) return { ok: false, error: 'Caminho de imagem inválido.' };
    return { ok: true, value };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'Endereço de imagem inválido.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'O endereço da imagem precisa começar com https://' };
  }

  let allowedHost: string | null = null;
  if (supabaseUrl) {
    try {
      allowedHost = new URL(supabaseUrl).host;
    } catch {
      allowedHost = null;
    }
  }

  if (allowedHost && parsed.host === allowedHost) return { ok: true, value };

  return {
    ok: false,
    error:
      'Só entra imagem hospedada no Storage do Supabase ou já publicada em /images/. Outro endereço é bloqueado pelo navegador e a foto não aparece.',
  };
}
