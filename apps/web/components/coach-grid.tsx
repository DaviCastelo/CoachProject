import { StaticImage } from '@/components/static-image';
import { COACHES } from '@/lib/team';

/*
 * Quatro retratos recortados do pôster antigo, com nome e cargo em HTML.
 *
 * A moldura é `aspect-[2/5]` porque é a proporção em que as fotos foram
 * enquadradas no pôster original: forçar 3/4 cortaria cabeça ou tronco. E
 * `object-position` puxa para cima pelo mesmo motivo — se algo tiver que
 * sair do quadro, que seja o pé, não o rosto.
 */
export function CoachGrid({ roleLabel }: Readonly<{ roleLabel: string }>) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {COACHES.map((coach, i) => (
        <li
          key={coach.id}
          className="fx-stagger-item fx-tilt group"
          style={{ '--i': i } as React.CSSProperties}
        >
          <div className="skew-frame relative aspect-[2/5] border-l-4 border-t-4 border-accent-500">
            <div className="skew-frame-inner absolute inset-0">
              <StaticImage
                src={coach.image}
                alt={coach.name}
                fill
                sizes="(max-width: 768px) 45vw, 22vw"
                className="object-cover object-[center_18%] transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-transparent" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-display text-lg uppercase leading-tight tracking-wide">
              {coach.name}
            </p>
            <p className="text-eyebrow mt-0.5 text-muted-foreground">{roleLabel}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
