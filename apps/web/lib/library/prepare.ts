import { fitWithin, shouldCompressImage, withExtension } from '@ca-tempo/domain';

/**
 * Tudo aqui roda no navegador, antes do envio, para o bucket receber menos.
 *
 * Foto é redimensionada e vira WebP: uma foto de 4 MB do celular cai para
 * algumas centenas de KB, sem diferença visível na tela. Foto e vídeo ganham
 * uma miniatura de poucos KB, para a lista nunca precisar baixar o original.
 *
 * Vídeo não é recomprimido. Fazer isso no navegador trava celular e leva mais
 * tempo que o próprio envio.
 */

const MAX_IMAGE_SIDE = 2560;
const THUMB_SIDE = 480;
const IMAGE_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export type PreparedFile = {
  blob: Blob;
  name: string;
  type: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumb: Blob | null;
};

function toWebp(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxSide: number,
  quality: number,
): Promise<Blob | null> {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  context.drawImage(source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

async function prepareImage(file: File, type: string): Promise<PreparedFile> {
  const untouched: PreparedFile = {
    blob: file,
    name: file.name,
    type,
    width: null,
    height: null,
    duration: null,
    thumb: null,
  };

  let bitmap: ImageBitmap;
  try {
    // `from-image` respeita a rotação do EXIF: sem isso, foto em pé deita.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return untouched; // HEIC no Chrome: sobe como veio, sem miniatura.
  }

  const { width, height } = bitmap;
  const thumb = await toWebp(bitmap, width, height, THUMB_SIDE, THUMB_QUALITY);
  const compressed = shouldCompressImage(type, file.size)
    ? await toWebp(bitmap, width, height, MAX_IMAGE_SIDE, IMAGE_QUALITY)
    : null;
  bitmap.close();

  // Se o WebP saiu maior que o original, fica o original.
  if (compressed && compressed.size < file.size) {
    const final = fitWithin(width, height, MAX_IMAGE_SIDE);
    return {
      ...untouched,
      blob: compressed,
      name: withExtension(file.name, 'webp'),
      type: 'image/webp',
      width: final.width,
      height: final.height,
      thumb,
    };
  }

  return { ...untouched, width, height, thumb };
}

function prepareVideo(file: File, type: string): Promise<PreparedFile> {
  const result: PreparedFile = {
    blob: file,
    name: file.name,
    type,
    width: null,
    height: null,
    duration: null,
    thumb: null,
  };

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const finish = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };

    // Formato que o navegador não abre (.mov HEVC no Chrome) não pode segurar
    // o envio: sobe sem miniatura.
    const timer = setTimeout(finish, 8000);
    video.onerror = finish;

    video.onloadedmetadata = () => {
      result.width = video.videoWidth || null;
      result.height = video.videoHeight || null;
      result.duration = Number.isFinite(video.duration) ? video.duration : null;
      // Evita o primeiro quadro, que costuma ser preto.
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };

    video.onseeked = async () => {
      if (video.videoWidth > 0) {
        result.thumb = await toWebp(
          video,
          video.videoWidth,
          video.videoHeight,
          THUMB_SIDE,
          THUMB_QUALITY,
        );
      }
      finish();
    };

    video.src = url;
  });
}

export async function prepareFile(
  file: File,
  kind: string,
  type: string,
): Promise<PreparedFile> {
  if (kind === 'image') return prepareImage(file, type);
  if (kind === 'video') return prepareVideo(file, type);
  return {
    blob: file,
    name: file.name,
    type,
    width: null,
    height: null,
    duration: null,
    thumb: null,
  };
}
