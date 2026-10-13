import { StatCounter } from '@/components/stat-counter';
import { cn } from '@/lib/utils';

export type Stat = Readonly<{ id: string; value: number; label: string; suffix?: string }>;

/*
 * Faixa de números entre o hero e o resto da página.
 *
 * Os valores vêm do banco da própria organização, não de marketing: é o que
 * dá para afirmar sem o cliente assinar embaixo. Um número zerado não entra,
 * porque "0 atletas" na primeira dobra é pior do que não ter a faixa.
 */
/* Colunas pelo que sobrou, não pelo que existe: com dois números numa grade
   de quatro, eles encostam na esquerda e deixam metade da faixa vazia. */
const COLUNAS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export function StatsBand({ stats, locale }: Readonly<{ stats: readonly Stat[]; locale: string }>) {
  const shown = stats.filter((s) => s.value > 0);
  if (shown.length === 0) return null;

  return (
    <section className="on-dark border-y border-accent-500/25 bg-ink-900">
      <dl
        className={cn(
          'mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 md:py-12',
          COLUNAS[shown.length] ?? 'md:grid-cols-4',
        )}
      >
        {shown.map((stat, i) => (
          <div
            key={stat.id}
            className="fx-stagger-item flex flex-col-reverse items-center gap-1 text-center"
            style={{ '--i': i } as React.CSSProperties}
          >
            {/* `flex-col-reverse` só para o número ficar em cima da legenda
                sem inverter a ordem `dt` depois `dd` que o HTML exige. */}
            <dt className="text-eyebrow text-ink-300">{stat.label}</dt>
            <dd className="font-display text-4xl leading-none text-accent-500 md:text-5xl">
              <StatCounter value={stat.value} locale={locale} suffix={stat.suffix} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
