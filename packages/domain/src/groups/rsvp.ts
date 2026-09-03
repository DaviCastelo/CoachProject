/**
 * RSVP (brief §10–§12).
 * Três estados para a família: Going / Not Going / No Reply.
 * Os demais valores de `attendance_status` pertencem à chamada feita pelo coach.
 */

export const RSVP_STATUSES = ['confirmed', 'declined', 'invited'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  'invited',
  'confirmed',
  'declined',
  'present',
  'absent',
  'late',
  'excused',
  'no_show',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** A família só pode gravar estes três estados (espelha a policy `attendance_family_respond`). */
export function isRsvpStatus(value: string): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value);
}

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export type RsvpTally = {
  going: number;
  notGoing: number;
  noReply: number;
  total: number;
};

/** Resumo do RSVP de um evento, para o painel do coach. */
export function tallyRsvp(statuses: readonly string[]): RsvpTally {
  let going = 0;
  let notGoing = 0;
  let noReply = 0;

  for (const s of statuses) {
    if (s === 'confirmed' || s === 'present' || s === 'late') going += 1;
    else if (s === 'declined' || s === 'absent' || s === 'excused' || s === 'no_show') notGoing += 1;
    else noReply += 1;
  }

  return { going, notGoing, noReply, total: statuses.length };
}

/** O evento ainda aceita resposta? (não cancelado e ainda não terminou) */
export function canRespondToSession(
  session: { status: string; endsAt: string | Date },
  now: Date = new Date(),
): boolean {
  if (session.status !== 'scheduled') return false;
  const ends = session.endsAt instanceof Date ? session.endsAt : new Date(session.endsAt);
  return ends.getTime() > now.getTime();
}
