import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { getProgram, listLinkableForms } from '../actions';
import { ProgramDetailClient } from './program-detail';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function ProgramPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);

  const [program, forms] = await Promise.all([getProgram(id), listLinkableForms(id)]);
  if (!program) notFound();

  const canManage = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <ProgramDetailClient program={program} forms={forms} canManage={canManage} />
    </div>
  );
}
