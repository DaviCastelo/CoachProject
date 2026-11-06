/*
 * O time saía de `team-poster.png` e `founders.png`: imagens que traziam
 * dentro, em pixels, o título da seção e o nome de cada pessoa. O título
 * aparecia duas vezes e em dois idiomas (o HTML dizia "CONHEÇA O NOSSO TIME"
 * e a imagem logo abaixo dizia "MEET OUR TEAM"), nome de coach não era texto
 * para busca nem para leitor de tela, e nada ali podia ser animado em partes.
 *
 * Os pôsteres viraram um retrato por pessoa (ver `scripts/images.mjs`) e o
 * texto virou HTML. O cargo é chave de tradução; o nome é nome próprio.
 */

export type TeamMember = Readonly<{
  /** Chave estável para `key` de lista e para a tradução do cargo. */
  id: string;
  name: string;
  image: string;
}>;

export const COACHES: readonly TeamMember[] = [
  { id: 'tulio', name: 'Tulio Magalhaes', image: '/images/coach-tulio.webp' },
  { id: 'arthur', name: 'Arthur Pompeu', image: '/images/coach-arthur.webp' },
  { id: 'carlos', name: 'Carlos Barboza', image: '/images/coach-carlos.webp' },
  { id: 'lucas', name: 'Lucas Almeida', image: '/images/coach-lucas.webp' },
] as const;

export const FOUNDERS: readonly TeamMember[] = [
  { id: 'arthur', name: 'Arthur Pompeu', image: '/images/founder-arthur.webp' },
  { id: 'carlos', name: 'Carlos Barboza', image: '/images/founder-carlos.webp' },
] as const;
