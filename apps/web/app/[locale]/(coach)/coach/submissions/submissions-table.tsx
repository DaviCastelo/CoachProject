'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  setRegistrationStatus,
  getWaiverUrl,
  getRegistrationDetails,
  type RegistrationDetails,
} from './actions';

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

function prettyLabel(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
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
  const [error, setError] = useState<string | null>(null);

  const [openRow, setOpenRow] = useState<SubmissionRow | null>(null);
  const [details, setDetails] = useState<RegistrationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  function openDetails(row: SubmissionRow) {
    setError(null);
    setOpenRow(row);
    setDetails(null);
    setLoadingDetails(true);
    void getRegistrationDetails(row.id).then((d) => {
      setDetails(d);
      setLoadingDetails(false);
    });
  }

  function act(id: string, status: 'approved' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const res = await setRegistrationStatus(id, status);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpenRow(null);
        router.refresh();
      }
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

  const extraData = details
    ? Object.entries(details.data).filter(
        ([, v]) => v != null && v !== '' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
      )
    : [];

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {rows.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{r.athleteName}</span>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {[r.program, r.option].filter(Boolean).join(' · ') || '—'}
              {r.dob ? ` · DOB ${r.dob}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openDetails(r)}
            aria-label={`View ${r.athleteName}`}
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        </Card>
      ))}

      <Dialog
        open={openRow !== null}
        onOpenChange={(o) => {
          if (!o) setOpenRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openRow?.athleteName}</DialogTitle>
            <DialogDescription>
              {[openRow?.program, openRow?.option].filter(Boolean).join(' · ') || 'Registration'}
              {openRow ? ` · ${openRow.status}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto text-sm">
            {loadingDetails ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : !details ? (
              <p className="text-muted-foreground">Details not found.</p>
            ) : (
              <div className="space-y-4">
                {details.athlete ? (
                  <div>
                    <p className="mb-1 font-display text-xs uppercase tracking-wide text-muted-foreground">
                      Athlete
                    </p>
                    {Object.entries(details.athlete).map(([k, v]) => (
                      <DetailRow key={k} label={prettyLabel(k)} value={v} />
                    ))}
                  </div>
                ) : null}

                {extraData.length > 0 ? (
                  <div>
                    <p className="mb-1 font-display text-xs uppercase tracking-wide text-muted-foreground">
                      Form answers
                    </p>
                    {extraData.map(([k, v]) => (
                      <DetailRow key={k} label={prettyLabel(k)} value={String(v)} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter>
            {openRow?.athleteId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openRow.athleteId && openWaiver(openRow.athleteId)}
              >
                <FileText className="h-4 w-4" />
                Waiver PDF
              </Button>
            ) : null}
            {canApprove && openRow ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || openRow.status === 'approved'}
                  onClick={() => act(openRow.id, 'approved')}
                >
                  {pending ? '…' : 'Approve'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || openRow.status === 'rejected' || openRow.status === 'canceled'}
                  onClick={() => act(openRow.id, 'rejected')}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
