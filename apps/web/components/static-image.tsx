import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

type StaticImageProps = Omit<ImageProps, 'unoptimized' | 'alt'> & {
  unoptimized?: boolean;
  alt: string;
};

/**
 * Imagens locais em /images/ e /icons/ — unoptimized evita falhas do
 * otimizador com PNGs grandes e garante carga direta de public/.
 */
export function StaticImage({ className, unoptimized, src, alt, ...props }: StaticImageProps) {
  const srcStr = typeof src === 'string' ? src : '';
  const isLocalStatic =
    srcStr.startsWith('/images/') || srcStr.startsWith('/icons/');

  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={unoptimized ?? isLocalStatic}
      className={cn(className)}
      {...props}
    />
  );
}
