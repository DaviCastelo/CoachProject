import { StaticImage } from '@/components/static-image';
import { cn } from '@/lib/utils';

type BrandLogoProps = Readonly<{
  size?: number;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
  alt?: string;
}>;

export function BrandLogo({
  size = 32,
  showName = false,
  className,
  nameClassName,
  alt = 'CA Tempo Training',
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StaticImage
        src="/icons/logo.jpg"
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
      {showName ? (
        <span
          className={cn(
            'font-display text-lg uppercase tracking-wide hidden sm:inline',
            nameClassName,
          )}
        >
          CA Tempo
        </span>
      ) : null}
    </div>
  );
}
