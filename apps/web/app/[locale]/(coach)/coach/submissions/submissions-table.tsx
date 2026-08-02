'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { setRegistrationStatus, getWaiverUrl } from './actions';

export type SubmissionRow = {
  id: string;
  status: string;
  createdAt: string;
  athleteId: string | null;
  athleteName: string;
  dob: string | null;
  program: string | null;
  option: string | null;
  hasWaiver: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-danger/15 text-danger',
  canceled: 'bg-danger/15 text-danger',
  waitlisted: 'bg-info/15 text-info',
  completed: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {status}
    </span>
  );
}

export function SubmissionsTable({
  rows,
  canApprove,
}: {
  rows: SubmissionRow[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function act(id: string, status: 'approved' | 'rejected') {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setRegistrationStatus(id, status);
      if (!res.ok) setError(res.error);
      router.refresh();
      setBusyId(null);
    });
  }

  async function openWaiver(athleteId: string) {
    const url = await getWaiverUrl(athleteId);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError('No signed waiver PDF found for this athlete.');
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground">No registrations yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.athleteName}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {[r.program, r.option].filter(Boolean).join(' · ') || '—'}
                {r.dob ? ` · DOB ${r.dob}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!r.hasWaiver || !r.athleteId}
                onClick={() => r.athleteId && openWaiver(r.athleteId)}
              >
                {r.hasWaiver ? 'Waiver PDF' : 'No waiver'}
              </Button>

              {canApprove ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || r.status === 'approved'}
                    onClick={() => act(r.id, 'approved')}
                  >
                    {busyId === r.id ? '…' : 'Approve'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || r.status === 'rejected' || r.status === 'canceled'}
                    onClick={() => act(r.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
