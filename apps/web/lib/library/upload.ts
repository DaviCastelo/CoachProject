import { Upload } from 'tus-js-client';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'library';

/** O Storage do Supabase exige exatamente este tamanho de pedaço no TUS. */
const CHUNK_BYTES = 6 * 1024 * 1024;

/**
 * Envio retomável: o arquivo sobe em pedaços e, se a internet cair no meio,
 * continua de onde parou em vez de recomeçar. No 4G do campo isso é a
 * diferença entre conseguir e desistir.
 */
export function uploadToLibrary(params: {
  blob: Blob;
  path: string;
  token: string;
  type: string;
  onProgress: (fraction: number) => void;
}): { promise: Promise<void>; cancel: () => void } {
  let upload: Upload | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    upload = new Upload(params.blob, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable/sign`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        'x-signature': params.token,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      metadata: {
        bucketName: BUCKET,
        objectName: params.path,
        contentType: params.type,
        cacheControl: '3600',
      },
      onProgress: (sent, total) => params.onProgress(total > 0 ? sent / total : 0),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });

  return {
    promise,
    cancel: () => {
      void upload?.abort(true);
    },
  };
}

/** A miniatura tem poucos KB: um envio simples basta, e falhar não é grave. */
export async function uploadThumb(path: string, token: string, blob: Blob): Promise<void> {
  await createClient()
    .storage.from(BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType: 'image/webp' });
}
