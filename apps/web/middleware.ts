import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { createClient } from './lib/supabase/middleware';
import { checkRateLimit } from './lib/ratelimit';

const intlMiddleware = createMiddleware(routing);

const protectedPrefixes = ['/coach', '/family'];
const authPaths = ['/login', '/auth'];

function stripLocale(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];
  if (routing.locales.includes(maybeLocale as 'en' | 'pt-BR' | 'es')) {
    const rest = segments.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname;
}

function getLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];
  if (routing.locales.includes(maybeLocale as 'en' | 'pt-BR' | 'es')) {
    return maybeLocale;
  }
  return routing.defaultLocale;
}

function localizedUrl(request: NextRequest, path: string): URL {
  const locale = getLocaleFromPath(request.nextUrl.pathname);
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return new URL(`${prefix}${path}`, request.url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Arquivos estáticos em public/ — não passar por i18n nem auth
  if (
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const normalizedPath = stripLocale(pathname);

  // Rate limit auth routes
  if (authPaths.some((p) => normalizedPath.startsWith(p))) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const allowed = await checkRateLimit(`auth:${ip}`);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  }

  const { supabase, supabaseResponse } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPrefixes.some((p) => normalizedPath.startsWith(p));
  const isAuthPage = normalizedPath.startsWith('/login');

  if (isProtected && !user) {
    const loginUrl = localizedUrl(request, '/login');
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(localizedUrl(request, '/coach'));
  }

  const intlResponse = intlMiddleware(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    '/',
    '/(en|pt-BR|es)/:path*',
    '/((?!_next|api|auth|icons|images|manifest.webmanifest|sw.js|favicon.ico).*)',
  ],
};
