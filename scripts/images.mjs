/*
 * Gera os arquivos de `apps/web/public/images/` a partir dos PNGs originais
 * em `assets/images-source/`.
 *
 * Os originais saíram de `public/` porque pesavam 6 MB no total e eram
 * servidos crus: a landing sozinha baixava 3,5 MB de PNG antes de desenhar
 * qualquer coisa. Aqui eles viram WebP (queda de ~85%) e ficam fora do que
 * a Vercel publica.
 *
 * Os dois pôsteres (`team-poster`, `founders`) eram imagens de texto: traziam
 * dentro os títulos "MEET OUR TEAM" e os nomes dos coaches em pixels. Isso
 * duplicava o título da seção em outro idioma, não era traduzível, não era
 * selecionável, nenhum leitor de tela lia, e nada ali podia ganhar animação.
 * Então são recortados em um retrato por pessoa, e o texto passa a ser HTML.
 *
 * Os recortes abaixo foram medidos à mão em cima dos PNGs originais; se
 * alguém trocar um pôster, tem que medir de novo.
 *
 *   pnpm images
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'images-source');
const OUT = join(ROOT, 'apps', 'web', 'public', 'images');

/*
 * Fotos de fundo. Além de mudar de formato, perdem a borda.
 *
 * Todas são print de Instagram: trazem a setinha do carrossel colada na
 * lateral direita (uns 6% da largura), as bolinhas de paginação e a marca
 * d'água "ShotsByRyanQ" nas últimas ~30 linhas. Isso aparecia na tela, e
 * dentro dos cards de programa as setas pareciam botão de navegação que não
 * navega. O corte tira a moldura do app e deixa só a foto.
 *
 * Custo: a origem já era pequena (~689px de largura) e fica menor ainda. O
 * conserto de verdade é o cliente mandar as fotos originais do fotógrafo, em
 * vez de print do feed.
 */
const PASSTHROUGH = [
  'hero-action-1',
  'hero-action-2',
  'gallery-1',
  'gallery-2',
  'gallery-3',
  'gallery-4',
];

/** Fração de cada lado comida pela interface do Instagram. */
const CHROME = { left: 0.065, right: 0.065, top: 0.005, bottom: 0.04 };

/** [esquerda, topo, largura, altura] dentro de team-poster.png (688x852). */
const COACHES = [
  { out: 'coach-tulio', box: [34, 243, 146, 390] },
  { out: 'coach-arthur', box: [204, 289, 124, 378] },
  { out: 'coach-carlos', box: [368, 259, 170, 376] },
  { out: 'coach-lucas', box: [558, 293, 128, 370] },
];

/*
 * Em founders.png (677x854) cada retrato já vem recortado numa elipse sobre
 * um fundo de mármore claro. O recorte pega a caixa inteira da elipse: os
 * cantos de mármore que sobram somem atrás do `border-radius: 50%` da tela,
 * que reproduz exatamente a mesma elipse.
 */
const FOUNDERS = [
  { out: 'founder-arthur', box: [119, 339, 201, 312] },
  { out: 'founder-carlos', box: [370, 340, 204, 320] },
];

/* Alvo de altura no WebP. O retrato de origem tem ~380px de altura, então
   dobrar é o limite do que ainda parece nítido; acima disso só inventa pixel.
   A correção de verdade é o cliente mandar as fotos originais. */
const PORTRAIT_HEIGHT = 760;
const FOUNDER_HEIGHT = 640;

async function convert(name) {
  const input = sharp(join(SRC, `${name}.png`));
  const { width = 0, height = 0 } = await input.metadata();
  const left = Math.round(width * CHROME.left);
  const top = Math.round(height * CHROME.top);

  await input
    .extract({
      left,
      top,
      width: width - left - Math.round(width * CHROME.right),
      height: height - top - Math.round(height * CHROME.bottom),
    })
    .webp({ quality: 82, effort: 6 })
    .toFile(join(OUT, `${name}.webp`));
}

async function crop(source, { out, box }, height) {
  const [left, top, width, h] = box;
  await sharp(join(SRC, source))
    .extract({ left, top, width, height: h })
    .resize({ height, kernel: 'lanczos3' })
    .webp({ quality: 86, effort: 6 })
    .toFile(join(OUT, `${out}.webp`));
}

await mkdir(OUT, { recursive: true });

for (const name of PASSTHROUGH) await convert(name);
for (const c of COACHES) await crop('team-poster.png', c, PORTRAIT_HEIGHT);
for (const f of FOUNDERS) await crop('founders.png', f, FOUNDER_HEIGHT);

let total = 0;
for (const f of (await readdir(OUT)).sort()) {
  const { size } = await stat(join(OUT, f));
  total += size;
  const meta = await sharp(join(OUT, f)).metadata();
  console.log(f.padEnd(22), `${meta.width}x${meta.height}`.padEnd(10), `${Math.round(size / 1024)} KB`);
}
console.log('—'.repeat(44));
console.log('total'.padEnd(22), ' '.repeat(10), `${Math.round(total / 1024)} KB`);
