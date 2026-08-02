import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SkewImageFrameProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}

export function SkewImageFrame({
  src,
  alt,
  width = 800,
  height = 600,
  className,
  imageClassName,
  priority = false,
  sizes = '(max-width: 768px) 100vw, 800px',
}: SkewImageFrameProps) {
  return (
    <div className={cn('skew-frame relative', className)}>
      <div
        className="pointer-events-none absolute inset-0 z-10 border-t-4 border-l-4 border-accent-500"
        aria-hidden="true"
      />
      <div className="skew-frame-inner">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      </div>
    </div>
  );
}
