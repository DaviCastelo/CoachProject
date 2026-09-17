import { requireRole, requireMfaForAdmin, mustChangePassword } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppShell } from '@/components/app-shell';
import { PasswordGate } from '@/components/password-gate';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  await requireMfaForAdmin();
  const needsPasswordChange = await mustChangePassword();
  const db = (await createClient()) as unknown as SupabaseClient;
  const { count } = await db
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('status', 'pending');

  return (
    <AppShell variant="coach" pendingRegistrations={count ?? 0}>
      {children}
      {needsPasswordChange ? <PasswordGate /> : null}
    </AppShell>
  );
}
