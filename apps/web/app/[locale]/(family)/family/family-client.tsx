'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, X, MapPin, Users } from 'lucide-react';
import { canRespondToSession } from '@ca-tempo/domain';
import { respondRsvp, type FamilyAthlete, type FamilyEvent } from './actions';
import { formatDateTime } from '@/lib/format-datetime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';
import { EmptyState } from '@/components/empty-state';
import { FieldError } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

type Props = Readonly<{
  athletes: FamilyAthlete[];
  events: FamilyEvent[];
}>;

export function FamilyClient({ athletes, events }: Props) {
  const t = useTranslations('family');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [athleteFilter, setAthleteFilter] = useState<string>('__all__');

  const now = new Date();

  const upcoming = useMemo(
    () =>
      events.filter(
        (e) =>
          new Date(e.endsAt) >= now &&
          (athleteFilter === '__all__' || e.athleteId === athleteFilter),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, athleteFilter],
  );

  function respond(e: FamilyEvent, status: 'confirmed' | 'declined') {
    setError(null);
    startTransition(async () => {
      const res = await respondRsvp(e.sessionId, e.athleteId, status);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(status === 'confirmed' ? t('confirmed') : t('declined'));
        router.refresh();
      }
    });
  }

  const chipClass = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors',
      active
        ? 'border-accent-500 bg-accent-500/15 text-foreground'
        : 'border-input text-muted-foreground',
    );

  return (
    <div className="space-y-8">
      <FieldError>{error}</FieldError>

      {athletes.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAthleteFilter('__all__')}
            className={chipClass(athleteFilter === '__all__')}
          >
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {t('allChildren')}
          </button>
          {athletes.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAthleteFilter(a.id)}
              className={chipClass(athleteFilter === a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-eyebrow text-muted-foreground">{t('upcomingSessions')}</h2>

        {upcoming.length === 0 ? (
          <EmptyState
            namespace="family"
            titleKey="emptyTitle"
            descriptionKey="emptyDescription"
            iconName="calendar"
          />
        ) : (
          upcoming.map((e, idx) => {
            const open = canRespondToSession({ status: e.status, endsAt: e.endsAt }, now);
            return (
              <AthleticCard
                key={e.attendanceId}
                className={cn(
                  'p-4',
                  e.rsvp === 'confirmed' && 'border-success/40',
                  e.rsvp === 'declined' && 'opacity-70',
                  e.rsvp === 'invited' && open && 'border-warning/50',
                )}
              >
                {idx === 0 ? (
                  <p className="text-eyebrow mb-2 text-accent-700 dark:text-accent-500">
                    {t('nextSession')}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      {athletes.length > 1 ? (
                        <Badge variant="outline">{e.athleteName}</Badge>
                      ) : null}
                      {e.status === 'canceled' ? (
                        <Badge variant="danger">{t('eventCanceled')}</Badge>
                      ) : e.rsvp === 'confirmed' ? (
                        <Badge variant="success">{t('confirmed')}</Badge>
                      ) : e.rsvp === 'declined' ? (
                        <Badge variant="secondary">{t('declined')}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatDateTime(e.startsAt, locale)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {e.groupNames.length > 0 ? <span>{e.groupNames.join(', ')}</span> : null}
                      {e.fieldLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.fieldLabel}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {open && e.rsvp !== 'confirmed' && e.rsvp !== 'declined' ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={pending}
                        onClick={() => respond(e, 'confirmed')}
                      >
                        <Check className="h-4 w-4" />
                        {t('going')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => respond(e, 'declined')}
                      >
                        <X className="h-4 w-4" />
                        {t('notGoing')}
                      </Button>
                    </div>
                  ) : open ? (
                    <div className="flex shrink-0 gap-2">
                      {e.rsvp !== 'confirmed' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => respond(e, 'confirmed')}
                        >
                          {t('going')}
                        </Button>
                      ) : null}
                      {e.rsvp !== 'declined' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => respond(e, 'declined')}
                        >
                          {t('notGoing')}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Badge variant="secondary">{t('closed')}</Badge>
                  )}
                </div>

                {e.rsvp === 'invited' && open ? (
                  <p className="mt-2 text-xs text-warning">{t('pleaseRespond')}</p>
                ) : null}
              </AthleticCard>
            );
          })
        )}
      </section>
    </div>
  );
}
