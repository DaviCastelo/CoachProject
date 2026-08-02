import { StaticImage } from '@/components/static-image';
import { cn } from '@/lib/utils';

type PageHeroProps = Readonly<{
  imageSrc: string;
  imageAlt: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
  priority?: boolean;
}>;

export function PageHero({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  compact = false,
  className,
  children,
  priority = false,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden',
        compact ? 'min-h-[200px]' : 'min-h-[70vh] md:min-h-[85vh]',
        className,
      )}
    >
      <div className="absolute inset-0">
        <StaticImage
          src={imageSrc}
          alt={imageAlt}
          fill
          priority={priority}
          sizes="100vw"
          className={cn('object-cover', !compact && 'animate-hero-zoom')}
        />
        <div
          className={cn('absolute inset-0', compact ? 'hero-overlay-compact' : 'hero-overlay')}
        />
      </div>
      {(title || subtitle || children) && (
        <div
          className={cn(
            'relative z-10 flex flex-col items-center justify-center px-4 text-center',
            compact ? 'py-12' : 'min-h-[70vh] md:min-h-[85vh] py-16',
          )}
        >
          {title ? (
            <h1 className="mb-4 font-display text-4xl uppercase tracking-wide md:text-6xl lg:text-7xl">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mb-8 max-w-lg text-lg text-ink-200 md:text-xl">{subtitle}</p>
          ) : null}
          {children}
        </div>
      )}
    </section>
  );
}
