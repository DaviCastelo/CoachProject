import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

type StaticImageProps = Omit<ImageProps, 'alt'> & { alt: string };

/*
 * Era aqui que morava `unoptimized` ligado à força para tudo que vinha de
 * `/images/`, posto para fugir de falhas do otimizador com os PNGs grandes.
 * O remédio virou a doença: sem otimizador não existe AVIF, nem WebP, nem
 * `srcset`, então a landing mandava 3,5 MB de PNG cru para um celular.
 *
 * Os arquivos agora são WebP de dezenas de KB (ver `scripts/images.mjs`) e o
 * otimizador dá conta. Quem precisar continua podendo passar `unoptimized`.
 */
export function StaticImage({ className, alt, ...props }: StaticImageProps) {
  return <Image alt={alt} className={cn(className)} {...props} />;
}
