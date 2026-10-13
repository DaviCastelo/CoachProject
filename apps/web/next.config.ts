import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

/*
 * A CSP precisa liberar o Supabase que ESTE ambiente usa, não um padrão
 * genérico. Com `https://*.supabase.co` fixo no código, desenvolver contra o
 * Supabase local era impossível: o navegador bloqueava o próprio login, com
 * "violates the following Content Security Policy directive" no console e um
 * "não foi possível entrar" inútil na tela.
 *
 * Derivar da variável de ambiente conserta o local e ainda aperta produção,
 * que passa a liberar o projeto exato em vez de qualquer subdomínio da
 * Supabase.
 */
function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return ['https://*.supabase.co', 'wss://*.supabase.co'];

  try {
    const { origin, protocol, host } = new URL(raw);
    // Realtime usa WebSocket no mesmo host, trocando o esquema.
    const ws = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
    return [origin, ws];
  } catch {
    return ['https://*.supabase.co', 'wss://*.supabase.co'];
  }
}

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.sentry.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      `connect-src 'self' ${supabaseOrigins().join(' ')} https://*.posthog.com https://*.sentry.io https://accounts.google.com`,
      "frame-src https://accounts.google.com",
    ].join('; '),
  },
];

/*
 * O otimizador de imagem só busca host declarado aqui. `programs.hero_image_url`
 * aponta para o Storage do Supabase, que é o mesmo host já liberado na CSP
 * acima: as duas listas precisam andar juntas, senão a foto passa num lugar e
 * é barrada no outro.
 */
function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const { protocol, hostname, port } = new URL(raw);
    return [
      {
        protocol: protocol.replace(':', '') as 'http' | 'https',
        hostname,
        port: port || undefined,
        pathname: '/storage/v1/object/public/**',
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@ca-tempo/domain', '@ca-tempo/db'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: supabaseImagePatterns(),
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withSerwist(withNextIntl(nextConfig));
