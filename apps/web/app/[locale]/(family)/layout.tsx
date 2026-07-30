import { requireRole } from '@/lib/auth/guards';
import { AppShell } from '@/components/app-shell';

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['guardian', 'athlete']);

  return <AppShell variant="family">{children}</AppShell>;
}
