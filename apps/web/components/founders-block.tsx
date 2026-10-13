import { StaticImage } from '@/components/static-image';
import { FOUNDERS } from '@/lib/team';

/*
 * Os dois retratos já vieram recortados em elipse no pôster original, sobre
 * mármore claro. O recorte pega a caixa inteira da elipse e `rounded-[50%]`
 * na mesma proporção reconstrói exatamente aquela elipse por cima, então os
 * cantos de mármore ficam fora da máscara.
 */
export function FoundersBlock({ roleLabel }: Readonly<{ roleLabel: string }>) {
  return (
    <ul className="flex flex-wrap items-start justify-center gap-8 sm:gap-12">
      {FOUNDERS.map((founder, i) => (
        <li
          key={founder.id}
          className="fx-stagger-item group w-36 text-center sm:w-44"
          style={{ '--i': i } as React.CSSProperties}
        >
          <div className="relative aspect-[41/64] overflow-hidden rounded-[50%] ring-2 ring-accent-500/70 ring-offset-4 ring-offset-ink-900 transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_12px_40px_rgba(200,162,74,0.25)]">
            <StaticImage
              src={founder.image}
              alt={founder.name}
              fill
              sizes="(max-width: 640px) 144px, 176px"
              className="object-cover"
            />
          </div>
          <p className="text-eyebrow mt-4 text-accent-500">{roleLabel}</p>
          <p className="font-display text-xl uppercase leading-tight tracking-wide">
            {founder.name}
          </p>
        </li>
      ))}
    </ul>
  );
}
