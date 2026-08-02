import { cn } from '@/lib/utils';

interface SpeedLinesProps {
  className?: string;
  count?: number;
}

export function SpeedLines({ className, count = 6 }: SpeedLinesProps) {
  return (
    <div className={cn('flex gap-1', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="block h-6 w-0.5 rotate-[25deg] bg-foreground/60"
          style={{ opacity: 0.4 + (i % 3) * 0.2 }}
        />
      ))}
    </div>
  );
}
