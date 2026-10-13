export type Step = Readonly<{ title: string; text: string }>;

/*
 * Três passos entre cair na página e estar inscrito.
 *
 * Existe porque não havia nada contando isso: quem chegava via Instagram via
 * um hero, fotos e um botão "Entrar" que só serve para quem já tem conta.
 *
 * A linha dourada atrás dos números é desenhada conforme a seção sobe, com
 * `animation-timeline: view()` (ver `.fx-track` no globals.css). Sem JS, e
 * quem não suporta vê a linha inteira parada, que é o estado final.
 */
export function HowItWorks({ steps }: Readonly<{ steps: readonly Step[] }>) {
  return (
    <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
      <span className="fx-track" aria-hidden="true" />
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="fx-stagger-item relative"
          style={{ '--i': i } as React.CSSProperties}
        >
          <span
            aria-hidden="true"
            className="font-display inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent-500 bg-background text-xl text-accent-500"
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className="font-display mt-4 text-2xl uppercase tracking-wide">{step.title}</h3>
          <p className="mt-2 text-muted-foreground leading-relaxed">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
