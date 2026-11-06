'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatValue, type ValueFormat } from './format';

/**
 * Entrada dos cards e gráficos, uma vez, quando aparecem na tela.
 *
 * O estado escondido e a animação moram no CSS (`[data-reveal]`), dentro de
 * `prefers-reduced-motion: no-preference`: quem pediu menos movimento recebe
 * tudo pronto. O JS só marca o momento de começar.
 */
function useInView<T extends HTMLElement>(onEnter: (element: T) => void) {
  const ref = useRef<T>(null);
  const enter = useRef(onEnter);
  enter.current = onEnter;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver !== 'function') {
      enter.current(element);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        enter.current(element);
      },
      { threshold: 0.12 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function Reveal({
  children,
  className,
  index = 0,
}: Readonly<{ children: React.ReactNode; className?: string; index?: number }>) {
  const ref = useInView<HTMLDivElement>((element) => {
    element.dataset.in = 'true';
  });

  return (
    <div
      ref={ref}
      data-reveal=""
      className={cn(className)}
      style={{ '--reveal-i': index } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

const DURATION_MS = 900;

/**
 * Número que sobe até o valor. Ao trocar de período, anda do valor antigo até
 * o novo em vez de recomeçar do zero.
 *
 * Leitor de tela lê só o valor final, nunca a contagem no meio do caminho.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: Readonly<{ value: number; format: ValueFormat; className?: string }>) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  const started = useRef(false);
  const frame = useRef(0);

  function run(target: number) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      from.current = target;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    cancelAnimationFrame(frame.current);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      setShown(origin + (target - origin) * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  const ref = useInView<HTMLSpanElement>(() => {
    started.current = true;
    run(value);
  });

  useEffect(() => {
    if (started.current) run(value);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  const rounded = format.kind === 'percent' || format.kind === 'hours' ? shown : Math.round(shown);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{formatValue(value, format)}</span>
      <span aria-hidden="true">{formatValue(rounded, format)}</span>
    </span>
  );
}
