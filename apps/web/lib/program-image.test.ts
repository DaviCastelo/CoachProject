import { describe, expect, it } from 'vitest';
import { parseProgramImageUrl, programImage, programImageForSlug } from './program-image';

const SUPABASE = 'https://abcdefgh.supabase.co';

describe('programImage', () => {
  it('usa a foto do programa quando ela existe', () => {
    expect(programImage({ slug: 'summer-camp', hero_image_url: '/images/x.webp' })).toBe(
      '/images/x.webp',
    );
  });

  it('cai no sorteio por slug quando a coluna está vazia', () => {
    expect(programImage({ slug: 'summer-camp', hero_image_url: null })).toBe(
      programImageForSlug('summer-camp'),
    );
  });

  it('trata string só de espaço como ausência de foto', () => {
    expect(programImage({ slug: 'summer-camp', hero_image_url: '   ' })).toBe(
      programImageForSlug('summer-camp'),
    );
  });

  it('dá sempre a mesma foto para o mesmo slug', () => {
    expect(programImageForSlug('clinic-2026')).toBe(programImageForSlug('clinic-2026'));
  });
});

describe('parseProgramImageUrl', () => {
  it('aceita caminho local em /images/', () => {
    expect(parseProgramImageUrl('/images/gallery-1.webp', SUPABASE)).toEqual({
      ok: true,
      value: '/images/gallery-1.webp',
    });
  });

  it('aceita https no host do Supabase do ambiente', () => {
    const url = `${SUPABASE}/storage/v1/object/public/fotos/camp.webp`;
    expect(parseProgramImageUrl(url, SUPABASE)).toEqual({ ok: true, value: url });
  });

  it('campo vazio limpa a coluna em vez de virar erro', () => {
    expect(parseProgramImageUrl('   ', SUPABASE)).toEqual({ ok: true, value: null });
  });

  it('corta espaço nas pontas', () => {
    expect(parseProgramImageUrl('  /images/a.webp  ', SUPABASE)).toEqual({
      ok: true,
      value: '/images/a.webp',
    });
  });

  /* O caso que motivou a função: a CSP só libera o host do Supabase, então
     uma foto de outro domínio é aceita no banco e nunca aparece na tela. */
  it('recusa host de fora, que a CSP bloquearia em silêncio', () => {
    const r = parseProgramImageUrl('https://cdn.exemplo.com/foto.jpg', SUPABASE);
    expect(r.ok).toBe(false);
  });

  it('recusa http puro', () => {
    const r = parseProgramImageUrl(`http://abcdefgh.supabase.co/x.webp`, SUPABASE);
    expect(r.ok).toBe(false);
  });

  it('recusa texto que não é endereço', () => {
    expect(parseProgramImageUrl('foto do verão', SUPABASE).ok).toBe(false);
  });

  it('recusa travessia de diretório disfarçada de caminho local', () => {
    expect(parseProgramImageUrl('/images/../../etc/passwd', SUPABASE).ok).toBe(false);
  });

  /* Achado por teste de mutação: trocar `/images/` por `/` não quebrava nada,
     ou seja, qualquer rota do próprio site entrava como se fosse foto. */
  it('recusa caminho do site que não seja /images/', () => {
    for (const p of ['/api/invoices', '/coach/payments', '/favicon.ico', '/imagesfake/a.webp']) {
      expect(parseProgramImageUrl(p, SUPABASE).ok, p).toBe(false);
    }
  });

  it('sem Supabase configurado, só caminho local passa', () => {
    expect(parseProgramImageUrl('/images/a.webp', undefined).ok).toBe(true);
    expect(parseProgramImageUrl(`${SUPABASE}/x.webp`, undefined).ok).toBe(false);
  });

  it('não confunde host que apenas termina igual', () => {
    const r = parseProgramImageUrl('https://evil-abcdefgh.supabase.co/x.webp', SUPABASE);
    expect(r.ok).toBe(false);
  });
});
