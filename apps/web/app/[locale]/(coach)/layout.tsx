import { requireRole, requireMfaForAdmin } from '@/lib/auth/guards';
import { AppShell } from '@/components/app-shell';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['owner', 'admin', 'coach', 'staff']);
  await requireMfaForAdmin();

  return <AppShell variant="coach">{children}</AppShell>;
}
