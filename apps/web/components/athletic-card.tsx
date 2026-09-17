import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface AthleticCardProps {
  children: React.ReactNode;
  className?: string;
  /** Hover lift + gold glow — only for showcase cards, never lists. */
  lift?: boolean;
}

export function AthleticCard({ children, className, lift = false }: AthleticCardProps) {
  return (
    <Card className={cn('athletic-card overflow-hidden', lift && 'athletic-card-lift', className)}>
      {children}
    </Card>
  );
}
