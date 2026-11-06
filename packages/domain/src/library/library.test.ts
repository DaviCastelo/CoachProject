import { describe, expect, it } from 'vitest';
import {
  fitWithin,
  formatBytes,
  parseLibraryLink,
  resolveLibraryType,
  shouldCompressImage,
  withExtension,
} from './index';

describe('resolveLibraryType', () => {
  it('reconhece foto, vídeo, PDF e documento pelo MIME', () => {
    expect(resolveLibraryType({ name: 'a.jpg', type: 'image/jpeg' })?.kind).toBe('image');
    expect(resolveLibraryType({ name: 'a.mp4', type: 'video/mp4' })?.kind).toBe('video');
    expect(resolveLibraryType({ name: 'a.pdf', type: 'application/pdf' })?.kind).toBe('pdf');
    expect(resolveLibraryType({ name: 'a.csv', type: 'text/csv' })?.kind).toBe('document');
  });

  it('usa a extensão quando o sistema não informa o tipo', () => {
    expect(resolveLibraryType({ name: 'Jogo.MOV', type: '' })).toEqual({
      kind: 'video',
      mime: 'video/quicktime',
    });
  });

  it('usa a extensão quando o tipo vem genérico', () => {
    expect(resolveLibraryType({ name: 'foto.heic', type: 'application/octet-stream' })?.mime).toBe(
      'image/heic',
    );
  });

  it('ignora parâmetros do MIME', () => {
    expect(resolveLibraryType({ name: 'a.txt', type: 'text/plain; charset=utf-8' })?.mime).toBe(
      'text/plain',
    );
  });

  /* SVG e HTML executam script ao abrir. */
  it('recusa o que pode rodar script', () => {
    expect(resolveLibraryType({ name: 'a.svg', type: 'image/svg+xml' })).toBeNull();
    expect(resolveLibraryType({ name: 'a.html', type: 'text/html' })).toBeNull();
  });

  it('não deixa a extensão enganar um tipo declarado', () => {
    expect(resolveLibraryType({ name: 'foto.jpg', type: 'text/html' })).toBeNull();
  });

  it('recusa extensão desconhecida sem tipo', () => {
    expect(resolveLibraryType({ name: 'virus.exe', type: '' })).toBeNull();
  });
});

describe('shouldCompressImage', () => {
  it('comprime foto grande', () => {
    expect(shouldCompressImage('image/jpeg', 4_000_000)).toBe(true);
  });

  it('deixa foto pequena como está', () => {
    expect(shouldCompressImage('image/jpeg', 100_000)).toBe(false);
  });

  it('não toca em GIF nem HEIC', () => {
    expect(shouldCompressImage('image/gif', 4_000_000)).toBe(false);
    expect(shouldCompressImage('image/heic', 4_000_000)).toBe(false);
  });
});

describe('fitWithin', () => {
  it('reduz pelo lado maior mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it('nunca amplia', () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });
});

describe('withExtension', () => {
  it('troca a extensão', () => {
    expect(withExtension('Treino final.JPG', 'webp')).toBe('Treino final.webp');
  });

  it('acrescenta quando não existe', () => {
    expect(withExtension('Treino', 'webp')).toBe('Treino.webp');
  });
});

describe('parseLibraryLink', () => {
  it('reconhece os formatos do YouTube', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ]) {
      expect(parseLibraryLink(url)?.youtubeId, url).toBe(id);
    }
  });

  it('aceita outro site https, sem miniatura', () => {
    expect(parseLibraryLink('https://vimeo.com/123')).toEqual({
      url: 'https://vimeo.com/123',
      youtubeId: null,
    });
  });

  it('não confunde domínio parecido com YouTube', () => {
    expect(parseLibraryLink('https://notyoutube.com/watch?v=dQw4w9WgXcQ')?.youtubeId).toBeNull();
  });

  it('corta espaço nas pontas', () => {
    expect(parseLibraryLink('  https://youtu.be/dQw4w9WgXcQ ')?.youtubeId).toBe('dQw4w9WgXcQ');
  });

  it('recusa o que não é https', () => {
    expect(parseLibraryLink('javascript:alert(1)')).toBeNull();
    expect(parseLibraryLink('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(parseLibraryLink('jogo de sábado')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('escolhe a unidade', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(52_428_800, 'en')).toBe('52.4 MB');
    expect(formatBytes(900_000_000, 'en')).toBe('900 MB');
    expect(formatBytes(1_500_000_000, 'en')).toBe('1.5 GB');
  });
});
