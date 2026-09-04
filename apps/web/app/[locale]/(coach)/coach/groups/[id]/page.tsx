import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { getGroup, listGroups, listOrgCoaches } from '../actions';
import { GroupDetailClient } from './group-detail-client';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string; id: string }> };

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(['owner', 'admin', 'coach', 'staff']);

  const [group, allGroups, orgCoaches] = await Promise.all([
    getGroup(id),
    listGroups(),
    listOrgCoaches(),
  ]);

  if (!group) notFound();

  const canManage = ctx.role === 'owner' || ctx.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <GroupDetailClient
        group={group}
        allGroups={allGroups}
        orgCoaches={orgCoaches}
        canManage={canManage}
      />
    </div>
  );
}
