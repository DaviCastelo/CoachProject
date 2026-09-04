import { requireRole, mustChangePassword } from '@/lib/auth/guards';
import { AppShell } from '@/components/app-shell';
import { PasswordGate } from '@/components/password-gate';

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['guardian', 'athlete']);
  const needsPasswordChange = await mustChangePassword();

  return (
    <AppShell variant="family">
      {children}
      {needsPasswordChange ? <PasswordGate /> : null}
    </AppShell>
  );
}
