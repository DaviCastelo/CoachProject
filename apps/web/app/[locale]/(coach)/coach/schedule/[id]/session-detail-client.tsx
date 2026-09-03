'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, X, Clock, Send, Ban, MapPin, Trash2 } from 'lucide-react';
import { tallyRsvp } from '@ca-tempo/domain';
import {
  publishSession,
  cancelSession,
  deleteSession,
  markAttendance,
  type SessionDetail,
} from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Props = Readonly<{ session: SessionDetail; canEdit: boolean }>;

const RSVP_BADGE: Record<string, { variant: 'success' | 'danger' | 'secondary'; key: string }> = {
  confirmed: { variant: 'success', key: 'going' },
  present: { variant: 'success', key: 'present' },
  late: { variant: 'success', key: 'late' },
  declined: { variant: 'danger', key: 'notGoing' },
  absent: { variant: 'danger', key: 'absent' },
  excused: { variant: 'danger', key: 'excused' },
  no_show: { variant: 'danger', key: 'noShow' },
  invited: { variant: 'secondary', key: 'noReply' },
};

export function SessionDetailClient({ session, canEdit }: Props) {
  const t = useTranslations('schedule');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const tally = tallyRsvp(session.roster.map((r) => r.status));
  const isCanceled = session.status === 'canceled';

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/coach/schedule"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToSchedule')}
      </Link>

      <div>
        <p className="text-eyebrow text-accent-500">{t(`eventTypes.${session.eventType}`)}</p>
        <h1 className="font-display text-3xl uppercase tracking-wide">{session.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(session.startsAt).toLocaleString()} —{' '}
          {new Date(session.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {session.groupNames.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
          {isCanceled ? <Badge variant="danger">{t('canceled')}</Badge> : null}
          {!session.publishedAt && !isCanceled ? (
            <Badge variant="warning">{t('draft')}</Badge>
          ) : null}
          {session.fieldLabel ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {session.fieldLabel}
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Resumo do RSVP */}
      <div className="grid grid-cols-3 gap-3">
        <AthleticCard className="p-4 text-center">
          <Check className="mx-auto mb-1 h-5 w-5 text-success" />
          <p className="font-display text-2xl">{tally.going}</p>
          <p className="text-xs text-muted-foreground">{t('going')}</p>
        </AthleticCard>
        <AthleticCard className="p-4 text-center">
          <X className="mx-auto mb-1 h-5 w-5 text-danger" />
          <p className="font-display text-2xl">{tally.notGoing}</p>
          <p className="text-xs text-muted-foreground">{t('notGoing')}</p>
        </AthleticCard>
        <AthleticCard className="p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="font-display text-2xl">{tally.noReply}</p>
          <p className="text-xs text-muted-foreground">{t('noReply')}</p>
        </AthleticCard>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {!session.publishedAt && !isCanceled ? (
            <Button size="sm" disabled={pending} onClick={() => run(() => publishSession(session.id))}>
              <Send className="h-4 w-4" />
              {t('publish')}
            </Button>
          ) : null}
          {!isCanceled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="h-4 w-4" />
              {t('cancelEvent')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => deleteSession(session.id), () => router.push('/coach/schedule'))
            }
          >
            <Trash2 className="h-4 w-4 text-danger" />
            {t('delete')}
          </Button>
        </div>
      ) : null}

      {/* Lista de atletas convidados */}
      <div className="space-y-2">
        <h2 className="text-eyebrow pt-2 text-muted-foreground">
          {t('attendees', { count: session.roster.length })}
        </h2>

        {session.roster.length === 0 ? (
          <p className="rounded-md border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            {session.publishedAt ? t('noAttendees') : t('publishToInvite')}
          </p>
        ) : (
          session.roster.map((r) => {
            const badge = RSVP_BADGE[r.status] ?? RSVP_BADGE.invited;
            return (
              <AthleticCard
                key={r.athleteId}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <span className="font-medium">{r.name}</span>
                  <div className="mt-0.5">
                    <Badge variant={badge.variant}>{t(badge.key)}</Badge>
                  </div>
                </div>

                {canEdit && !isCanceled ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => markAttendance(session.id, r.athleteId, 'present'))}
                    >
                      <Check className="h-4 w-4 text-success" />
                      {t('markPresent')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => markAttendance(session.id, r.athleteId, 'absent'))}
                    >
                      <X className="h-4 w-4 text-danger" />
                      {t('markAbsent')}
                    </Button>
                  </div>
                ) : null}
              </AthleticCard>
            );
          })
        )}
      </div>

      <Dialog open={cancelOpen} onOpenChange={(o) => !pending && setCancelOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelEvent')}</DialogTitle>
            <DialogDescription>{t('cancelEventHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">{t('cancelReason')}</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('cancelReasonPlaceholder')}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              className="bg-danger text-white hover:bg-danger/90"
              disabled={pending}
              onClick={() =>
                run(() => cancelSession(session.id, reason), () => setCancelOpen(false))
              }
            >
              {pending ? t('saving') : t('confirmCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
