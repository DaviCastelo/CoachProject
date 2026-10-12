'use client';

import { StaticImage } from '@/components/static-image';

const SLIDES = [
  { src: '/images/hero-action-1.png', alt: 'Athletes training at CA Tempo' },
  { src: '/images/hero-action-2.png', alt: '' },
] as const;

type LandingHeroProps = Readonly<{
  lead: string;
  trail: string;
  subtitle: string;
  ticker: readonly string[];
  children?: React.ReactNode;
}>;

export function LandingHero({ lead, trail, subtitle, ticker, children }: LandingHeroProps) {
  const loop = [...ticker, ...ticker];

  return (
    <section className="landing-hero relative min-h-[70vh] overflow-hidden md:min-h-[85vh]">
      <div className="landing-hero-stage absolute inset-0">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className={index === 0 ? 'landing-hero-slide landing-hero-slide-a' : 'landing-hero-slide landing-hero-slide-b'}
          >
            <StaticImage
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className="landing-hero-photo"
            />
          </div>
        ))}
        <div className="hero-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center md:min-h-[85vh]">
        <h1 className="mb-4 flex flex-col items-center font-display text-5xl uppercase leading-none tracking-wide text-ink-50 sm:text-6xl md:flex-row md:gap-4 md:text-7xl lg:text-8xl">
          <span className="landing-hero-word-left">{lead}</span>
          <span className="landing-hero-word-right">{trail}</span>
        </h1>
        <p className="landing-hero-subtitle mb-6 max-w-lg text-lg text-ink-200 md:text-xl">{subtitle}</p>
        <div className="landing-hero-pitch" aria-hidden="true">
          <span className="landing-hero-line" />
          <svg className="landing-hero-goal" viewBox="0 0 80 64">
            <g className="landing-hero-net">
              <path d="M8 10 H72 V56 H8 Z" />
              <path d="M8 22 H72 M8 34 H72 M8 46 H72 M24 10 V56 M40 10 V56 M56 10 V56" />
            </g>
            <path className="landing-hero-frame" d="M8 56 V10 H72 V56" />
          </svg>
          <span className="landing-hero-ball">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10.2" fill="#f7f4ee" stroke="#111" strokeWidth="1.4" />
              <polygon points="12,5.2 16.2,8.2 14.6,13.4 9.4,13.4 7.8,8.2" fill="#111" />
            </svg>
          </span>
        </div>
        <div className="landing-hero-actions mt-5">{children}</div>
      </div>

      <div className="landing-hero-ticker" aria-hidden="true">
        <div className="landing-hero-ticker-track">
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
