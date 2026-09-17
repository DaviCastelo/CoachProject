'use client';

import dynamic from 'next/dynamic';

export const ScheduleCalendarLazy = dynamic(
  () => import('@/components/schedule-calendar').then((m) => m.ScheduleCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="h-[620px] animate-pulse rounded-xl border border-border bg-muted" />
    ),
  },
);
