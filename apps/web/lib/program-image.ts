const GALLERY_IMAGES = [
  '/images/gallery-1.png',
  '/images/gallery-2.png',
  '/images/gallery-3.png',
  '/images/gallery-4.png',
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
