import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { OrgRole } from '@ca-tempo/db';

const ACTIVE_ORG_COOKIE = 'active_org_id';

export interface ActiveOrgContext {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
  userId: string;
}

export async function getActiveOrg(): Promise<ActiveOrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships?.length) return null;

  const selected = memberships.find((m) => m.organization_id === activeOrgId) ?? memberships[0];
  if (!selected) return null;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', selected.organization_id)
    .single();

  if (!org) return null;

  return {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    role: selected.role as OrgRole,
    userId: user.id,
  };
}

export async function requireRole(allowedRoles: OrgRole[]): Promise<ActiveOrgContext> {
  const ctx = await getActiveOrg();
  if (!ctx) {
    redirect('/login');
  }
  if (!allowedRoles.includes(ctx.role)) {
    redirect('/login?error=unauthorized');
  }
  return ctx;
}

export async function requireMfaForAdmin(): Promise<void> {
  const supabase = await createClient();
  const ctx = await getActiveOrg();
  if (!ctx) return;

  if (ctx.role !== 'owner' && ctx.role !== 'admin') return;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = factors?.totp?.some((f) => f.status === 'verified');

  if (!hasVerifiedTotp) {
    redirect('/auth/mfa');
  }
}

export { ACTIVE_ORG_COOKIE };
