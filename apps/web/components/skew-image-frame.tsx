import { StaticImage } from '@/components/static-image';
import { cn } from '@/lib/utils';

const OVERLAY_CLASS =
  'pointer-events-none absolute inset-0 z-10 border-t-4 border-l-4 border-accent-500';

export function SkewImageFrame(
  props: Readonly<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    imageClassName?: string;
    priority?: boolean;
    sizes?: string;
  }>,
) {
  const {
    src,
    alt,
    width = 800,
    height = 600,
    className,
    imageClassName,
    priority = false,
    sizes = '(max-width: 768px) 100vw, 800px',
  } = props;

  return (
    <div className={cn('skew-frame relative', className)}>
      <div className={OVERLAY_CLASS} aria-hidden />
      <div className="skew-frame-inner">
        <StaticImage
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
