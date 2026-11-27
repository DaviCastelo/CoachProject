import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'pt-BR', 'es'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  // O clube atende famílias nos EUA: o site abre sempre em inglês americano.
  // Com a detecção ligada, um navegador em português caía em /pt-BR e via o
  // painel traduzido em volta de formulários escritos em inglês. Quem quiser
  // outro idioma troca no seletor, e a escolha fica no endereço (/pt-BR, /es).
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
