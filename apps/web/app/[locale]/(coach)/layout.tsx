import { requireRole, requireMfaForAdmin, mustChangePassword } from '@/lib/auth/guards';
import { AppShell } from '@/components/app-shell';
import { PasswordGate } from '@/components/password-gate';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['owner', 'admin', 'coach', 'staff']);
  await requireMfaForAdmin();
  const needsPasswordChange = await mustChangePassword();

  return (
    <AppShell variant="coach">
      {children}
      {needsPasswordChange ? <PasswordGate /> : null}
    </AppShell>
  );
}
