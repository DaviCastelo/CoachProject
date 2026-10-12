import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRegisterPath } from '@/lib/auth/register-redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRegisterPath(searchParams.get('next')) ?? '/coach';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
