import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { NewFormForm, type ProgramChoice } from './new-form-form';

export const dynamic = 'force-dynamic';

export default async function NewFormPage() {
  const ctx = await requireRole(['owner', 'admin']);
  const db = await createClient();
  const { data } = await db
    .from('programs')
    .select('id, name')
    .eq('organization_id', ctx.orgId)
    .order('name', { ascending: true });

  return <NewFormForm programs={(data ?? []) as ProgramChoice[]} />;
}
