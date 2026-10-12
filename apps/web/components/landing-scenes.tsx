'use client';

import { useEffect } from 'react';

export function LandingScenes() {
  useEffect(() => {
    const scenes = document.querySelectorAll('[data-landing-scene]');
    if (scenes.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scenes.forEach((scene) => scene.setAttribute('data-show', 'true'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-show', 'true');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.22, rootMargin: '0px 0px -8% 0px' },
    );

    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);

  return null;
}
