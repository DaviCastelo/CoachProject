import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Destino após o login: staff vai para o painel do coach; responsável e atleta
 * vão para o portal da família. Evita mandar todo mundo para /coach e levar
 * um "sem acesso" na cara.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const roles = new Set(((data ?? []) as { role: string }[]).map((m) => m.role));
  const isStaff = ['owner', 'admin', 'coach', 'staff'].some((r) => roles.has(r));

  if (isStaff) return NextResponse.redirect(`${origin}/coach`);
  if (roles.has('guardian') || roles.has('athlete')) {
    return NextResponse.redirect(`${origin}/family`);
  }

  return NextResponse.redirect(`${origin}/login?error=unauthorized`);
}
