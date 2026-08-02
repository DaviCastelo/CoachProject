import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SubmissionsTable, type SubmissionRow } from './submissions-table';

export const dynamic = 'force-dynamic';

type RawReg = {
  id: string;
  status: string;
  created_at: string;
  athlete_id: string | null;
  athletes: { first_name: string; last_name: string; date_of_birth: string } | null;
  programs: { name: string } | null;
  program_options: { name: string } | null;
};

type RawWaiver = { athlete_id: string; pdf_url: string | null };

export default async function SubmissionsPage() {
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const db = (await createClient()) as unknown as SupabaseClient;

  const { data: regsData } = await db
    .from('registrations')
    .select(
      'id, status, created_at, athlete_id, athletes(first_name, last_name, date_of_birth), programs(name), program_options(name)',
    )
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: waiverData } = await db
    .from('waiver_signatures')
    .select('athlete_id, pdf_url')
    .eq('organization_id', ctx.orgId)
    .not('pdf_url', 'is', null)
    .order('signed_at', { ascending: false });

  const pdfByAthlete = new Set<string>();
  for (const w of (waiverData ?? []) as unknown as RawWaiver[]) {
    if (w.pdf_url) pdfByAthlete.add(w.athlete_id);
  }

  const rows: SubmissionRow[] = ((regsData ?? []) as unknown as RawReg[]).map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    athleteId: r.athlete_id,
    athleteName: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : '—',
    dob: r.athletes?.date_of_birth ?? null,
    program: r.programs?.name ?? null,
    option: r.program_options?.name ?? null,
    hasWaiver: r.athlete_id ? pdfByAthlete.has(r.athlete_id) : false,
  }));

  const canApprove = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <h1 className="mb-1 font-display text-3xl uppercase tracking-wide">Registrations</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {rows.length} total{canApprove ? '' : ' · view only'}
      </p>
      <SubmissionsTable rows={rows} canApprove={canApprove} />
    </div>
  );
}
