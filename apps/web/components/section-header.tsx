import { cn } from '@/lib/utils';
import { SpeedLines } from '@/components/speed-lines';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  className?: string;
  showSpeedLines?: boolean;
}

export function SectionHeader({
  eyebrow,
  title,
  className,
  showSpeedLines = true,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-8 text-center', className)}>
      {eyebrow ? (
        <p className="text-eyebrow mb-2 text-muted-foreground">{eyebrow}</p>
      ) : null}
      <div className="flex items-center justify-center gap-4">
        {showSpeedLines ? <SpeedLines className="hidden sm:flex" /> : null}
        <h2 className="font-display text-4xl uppercase tracking-wide md:text-5xl">{title}</h2>
        {showSpeedLines ? <SpeedLines className="hidden sm:flex" /> : null}
      </div>
    </div>
  );
}
