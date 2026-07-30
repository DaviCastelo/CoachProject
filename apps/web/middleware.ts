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
    return `/${segments.slice(2).join('/')}` || '/';
  }
  return pathname;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/coach', request.url));
  }

  const intlResponse = intlMiddleware(request);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ['/', '/(en|pt-BR|es)/:path*', '/((?!_next|api|auth|icons|manifest.webmanifest|sw.js|favicon.ico).*)'],
};
