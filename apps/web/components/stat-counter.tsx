'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * Contagem subindo quando o número entra na tela.
 *
 * O valor final é o que sai do servidor, então ele já está no HTML: sem JS,
 * com JS quebrado ou com "reduzir movimento" ligado, o número certo aparece
 * do mesmo jeito. A animação só substitui o texto depois que o componente
 * monta, e só enquanto estiver subindo.
 */
export function StatCounter({
  value,
  locale,
  suffix,
}: Readonly<{ value: number; locale: string; suffix?: string }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver !== 'function') return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();

        const duration = 1100;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic: arranca rápido e encosta devagar no valor final.
          const eased = 1 - (1 - t) ** 3;
          setShown(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setShown(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString(locale)}
      {suffix ?? ''}
    </span>
  );
}
