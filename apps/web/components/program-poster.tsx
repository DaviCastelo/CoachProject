import { StaticImage } from '@/components/static-image';
import { cn } from '@/lib/utils';

type ProgramPosterProps = Readonly<{
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}>;

/*
 * A imagem do programa inteira, na proporção dela.
 *
 * `width`/`height` são só a reserva de espaço antes do carregamento (4:5, o
 * formato de flyer de Instagram). Com `h-auto`, o navegador troca pela
 * proporção real do arquivo assim que ele chega, então foto deitada também
 * aparece certa, sem corte e sem faixa.
 */
export function ProgramPoster({ src, alt, className, priority = false }: ProgramPosterProps) {
  return (
    <div className={cn('mx-auto w-full', className)}>
      <StaticImage
        src={src}
        alt={alt}
        width={1080}
        height={1350}
        priority={priority}
        quality={90}
        sizes="(max-width: 480px) 100vw, 448px"
        className="h-auto w-full rounded-lg shadow-lg ring-1 ring-black/10"
      />
    </div>
  );
}
