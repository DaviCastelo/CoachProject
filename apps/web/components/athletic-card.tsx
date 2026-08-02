import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface AthleticCardProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export function AthleticCard({ children, className }: AthleticCardProps) {
  return (
    <Card className={cn('athletic-card overflow-hidden', className)}>{children}</Card>
  );
}
