import { StaticImage } from '@/components/static-image';

/*
 * A página terminava num botão de contorno pequeno, com a última coisa dita
 * ao visitante sendo "ver todos os programas". Agora termina num painel de
 * largura cheia: quem rolou até o fim é quem está mais perto de se inscrever.
 */
export function FinalCta({
  title,
  subtitle,
  children,
}: Readonly<{ title: string; subtitle: string; children: React.ReactNode }>) {
  return (
    <section className="on-dark fx-cut-top relative isolate overflow-hidden bg-ink-950">
      <StaticImage
        src="/images/gallery-1.webp"
        alt=""
        fill
        sizes="100vw"
        className="fx-cta-photo object-cover object-center"
      />
      <div className="absolute inset-0 bg-ink-950/80" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pb-20 pt-24 text-center md:pb-28 md:pt-32">
        <h2 className="fx-rise-mask font-display text-4xl uppercase leading-none tracking-wide text-ink-50 md:text-6xl">
          <span className="fx-rise">{title}</span>
        </h2>
        <p className="max-w-xl text-lg text-ink-200">{subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>
      </div>
    </section>
  );
}
