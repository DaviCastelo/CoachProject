import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { getSession } from '../actions';
import { SessionDetailClient } from './session-detail-client';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string; id: string }> };

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);
  const session = await getSession(id);

  if (!session) notFound();

  const canEdit = ctx.role === 'owner' || ctx.role === 'admin' || ctx.role === 'coach';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <SessionDetailClient session={session} canEdit={canEdit} />
    </div>
  );
}
