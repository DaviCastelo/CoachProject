'use client';

import { useEffect, useState } from 'react';
import { StaticImage } from '@/components/static-image';

const SLIDE_A = { src: '/images/hero-action-1.webp', alt: 'Athletes training at CA Tempo' };
const SLIDE_B = { src: '/images/hero-action-2.webp', alt: '' };

type LandingHeroProps = Readonly<{
  lead: string;
  trail: string;
  subtitle: string;
  ticker: readonly string[];
  children?: React.ReactNode;
}>;

export function LandingHero({ lead, trail, subtitle, ticker, children }: LandingHeroProps) {
  const loop = [...ticker, ...ticker];

  /*
   * A segunda foto só aparece aos 7 segundos do ciclo, mas estava no HTML
   * desde o primeiro byte. Como ela fica dentro da tela (escondida por
   * `opacity`, não por `display`), nem o lazy-load nativo nem o do Next a
   * seguravam: baixava junto com a primeira e disputava banda com ela.
   */
  const [showSecond, setShowSecond] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const id = idle(() => setShowSecond(true), { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setShowSecond(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className="landing-hero relative min-h-[70vh] overflow-hidden md:min-h-[85vh]">
      <div className="landing-hero-stage">
        {/* Camada só do parallax: o palco já carrega a animação de abertura e
            as fotos já carregam o Ken Burns, e uma propriedade `animation` não
            aceita dois donos. */}
        <div className="landing-hero-parallax">
          <div className="landing-hero-slide landing-hero-slide-a">
            <StaticImage
              src={SLIDE_A.src}
              alt={SLIDE_A.alt}
              fill
              priority
              sizes="100vw"
              className="landing-hero-photo"
            />
          </div>
          {showSecond ? (
            <div className="landing-hero-slide landing-hero-slide-b">
              <StaticImage
                src={SLIDE_B.src}
                alt={SLIDE_B.alt}
                fill
                sizes="100vw"
                className="landing-hero-photo"
              />
            </div>
          ) : null}
        </div>
        <div className="hero-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center md:min-h-[85vh]">
        <h1 className="mb-4 flex flex-col items-center font-display text-5xl uppercase leading-none tracking-wide text-ink-50 sm:text-6xl md:flex-row md:gap-4 md:text-7xl lg:text-8xl">
          <span className="fx-hero-lead">{lead}</span>
          <span className="fx-hero-trail">{trail}</span>
        </h1>
        <p className="fx-hero-in mb-6 max-w-lg text-lg text-ink-200 md:text-xl">{subtitle}</p>
        <div className="landing-hero-pitch" aria-hidden="true">
          <span className="landing-hero-line" />
          {/* viewBox 80x56 com a trave em y=56: a base do gol encosta na borda
              de baixo do SVG, que é a mesma linha do chão do campo. Antes
              sobravam 8 unidades por baixo e o gol flutuava acima da linha. */}
          <svg className="landing-hero-goal" viewBox="0 0 80 56">
            <g className="landing-hero-net">
              <path d="M8 6 H72 V56 H8 Z" />
              <path d="M8 19 H72 M8 31 H72 M8 44 H72 M24 6 V56 M40 6 V56 M56 6 V56" />
            </g>
            <path className="landing-hero-frame" d="M8 56 V6 H72 V56" />
          </svg>
          <span className="landing-hero-ball fx-shot">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10.2" fill="#f7f4ee" stroke="#111" strokeWidth="1.4" />
              <polygon points="12,5.2 16.2,8.2 14.6,13.4 9.4,13.4 7.8,8.2" fill="#111" />
            </svg>
          </span>
        </div>
        <div className="fx-hero-in mt-5">{children}</div>
      </div>

      <div className="landing-hero-ticker fx-ticker" tabIndex={0} aria-label={ticker.join(', ')}>
        <div className="landing-hero-ticker-track fx-ticker-track" aria-hidden="true">
          {loop.map((item, index) => (
            <span key={`${item}-${index}`} className="landing-hero-ticker-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
