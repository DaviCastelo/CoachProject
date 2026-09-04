'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, CalendarDays, MapPin, Users } from 'lucide-react';
import { canRespondToSession } from '@ca-tempo/domain';
import { respondRsvp, type FamilyAthlete, type FamilyEvent } from './actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AthleticCard } from '@/components/athletic-card';

type Props = Readonly<{
  athletes: FamilyAthlete[];
  events: FamilyEvent[];
}>;

export function FamilyClient({ athletes, events }: Props) {
  const t = useTranslations('family');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Um pai pode ter vários filhos: filtra por atleta (brief §12).
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
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Seletor de filho */}
      {athletes.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAthleteFilter('__all__')}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              athleteFilter === '__all__'
                ? 'border-accent-500 bg-accent-500/10 text-foreground'
                : 'border-input text-muted-foreground'
            }`}
          >
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {t('allChildren')}
          </button>
          {athletes.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAthleteFilter(a.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                athleteFilter === a.id
                  ? 'border-accent-500 bg-accent-500/10 text-foreground'
                  : 'border-input text-muted-foreground'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Agenda + RSVP */}
      <section className="space-y-3">
        <h2 className="text-eyebrow text-muted-foreground">{t('upcomingSessions')}</h2>

        {upcoming.length === 0 ? (
          <AthleticCard className="p-6 text-center">
            <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noSessionsScheduled')}</p>
          </AthleticCard>
        ) : (
          upcoming.map((e) => {
            const open = canRespondToSession({ status: e.status, endsAt: e.endsAt }, now);
            return (
              <AthleticCard key={e.attendanceId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      {athletes.length > 1 ? (
                        <Badge variant="outline">{e.athleteName}</Badge>
                      ) : null}
                      {e.status === 'canceled' ? (
                        <Badge variant="danger">{t('eventCanceled')}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(e.startsAt).toLocaleString()}
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

                  {open ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={e.rsvp === 'confirmed' ? 'default' : 'outline'}
                        disabled={pending}
                        onClick={() => respond(e, 'confirmed')}
                      >
                        <Check className="h-4 w-4" />
                        {t('going')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={e.rsvp === 'declined' ? 'destructive' : 'outline'}
                        disabled={pending}
                        onClick={() => respond(e, 'declined')}
                      >
                        <X className="h-4 w-4" />
                        {t('notGoing')}
                      </Button>
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
