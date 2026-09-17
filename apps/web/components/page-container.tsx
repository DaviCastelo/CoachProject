import { cn } from '@/lib/utils';

type PageContainerProps = Readonly<{
  children: React.ReactNode;
  className?: string;
  /** Form builder and marketing stay wider. Default is the app column. */
  width?: 'app' | 'wide';
}>;

export function PageContainer({ children, className, width = 'app' }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full p-4',
        width === 'wide' ? 'max-w-6xl' : 'max-w-3xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
