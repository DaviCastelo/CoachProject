'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import FullCalendar from '@fullcalendar/react';
import type { CalendarApi, DatesSetArg } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import esLocale from '@fullcalendar/core/locales/es';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pickScheduleInitialDate, countStartsInRange } from '@ca-tempo/domain';
import { useRouter } from '@/i18n/routing';
import type { SessionListItem } from '@/app/[locale]/(coach)/coach/schedule/actions';
import { Button } from '@/components/ui/button';

const TYPE_COLOR: Record<string, string> = {
  training: '#c8a24a',
  match: '#16794a',
  tryout: '#1f5f8b',
  meeting: '#6b6b6b',
};

const CALENDAR_VIEWS = ['timeGridWeek', 'dayGridMonth', 'listWeek'] as const;
type CalendarView = (typeof CALENDAR_VIEWS)[number];

const VIEW_LABEL: Record<CalendarView, 'week' | 'month' | 'list'> = {
  timeGridWeek: 'week',
  dayGridMonth: 'month',
  listWeek: 'list',
};

function fullCalendarLocale(locale: string): string {
  if (locale === 'pt-BR') return 'pt-br';
  if (locale === 'es') return 'es';
  return 'en';
}

export function ScheduleCalendar({ sessions }: Readonly<{ sessions: SessionListItem[] }>) {
  const locale = useLocale();
  const t = useTranslations('schedule');
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [viewTitle, setViewTitle] = useState('');
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentView, setCurrentView] = useState<CalendarView>('timeGridWeek');

  const events = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        title: s.title,
        start: s.startsAt,
        end: s.endsAt,
        backgroundColor: TYPE_COLOR[s.eventType] ?? '#c8a24a',
        borderColor: 'transparent',
        textColor: '#0a0a0a',
        classNames: s.isMine ? ['fc-event-mine'] : [],
      })),
    [sessions],
  );

  const startsAt = useMemo(() => sessions.map((s) => s.startsAt), [sessions]);
  const initialDate = useMemo(() => pickScheduleInitialDate(startsAt), [startsAt]);
  const fcLocale = fullCalendarLocale(locale);

  function api(): CalendarApi | undefined {
    return calendarRef.current?.getApi();
  }

  useEffect(() => {
    const calendar = calendarRef.current?.getApi();
    if (!calendar) return;
    setVisibleCount(countStartsInRange(startsAt, calendar.view.activeStart, calendar.view.activeEnd));
  }, [startsAt]);

  function onDatesSet(arg: DatesSetArg) {
    setViewTitle(arg.view.title);
    setVisibleCount(countStartsInRange(startsAt, arg.start, arg.end));
    if ((CALENDAR_VIEWS as readonly string[]).includes(arg.view.type)) {
      setCurrentView(arg.view.type as CalendarView);
    }
  }

  return (
    <div className="schedule-calendar overflow-hidden rounded-xl border border-border bg-card accent-border-top">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('prev')}
            onClick={() => api()?.prev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('next')}
            onClick={() => api()?.next()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={t('today')} onClick={() => api()?.today()}>
            {t('today')}
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{viewTitle}</p>
          <p className="text-xs text-muted-foreground">{t('visibleCount', { count: visibleCount })}</p>
        </div>

        <div className="flex items-center gap-1">
          {CALENDAR_VIEWS.map((view) => (
            <Button
              key={view}
              type="button"
              size="sm"
              variant={currentView === view ? 'default' : 'outline'}
              aria-label={t(VIEW_LABEL[view])}
              aria-pressed={currentView === view}
              onClick={() => api()?.changeView(view)}
            >
              {t(VIEW_LABEL[view])}
            </Button>
          ))}
        </div>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={initialDate}
        headerToolbar={false}
        locales={[ptBrLocale, esLocale]}
        locale={fcLocale}
        events={events}
        nowIndicator
        height={620}
        stickyHeaderDates
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        datesSet={onDatesSet}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          router.push(`/coach/schedule/${info.event.id}`);
        }}
      />
    </div>
  );
}
