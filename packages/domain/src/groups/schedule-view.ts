/** Primeiro horário futuro; se não houver, o passado mais recente. */
export function pickScheduleInitialDate(
  startsAt: readonly string[],
  now = Date.now(),
): Date | undefined {
  if (startsAt.length === 0) return undefined;
  const times = startsAt.map((value) => new Date(value).getTime());
  const future = times.filter((t) => t >= now).sort((a, b) => a - b);
  if (future[0] !== undefined) return new Date(future[0]);
  const past = times.filter((t) => t < now).sort((a, b) => b - a);
  return past[0] !== undefined ? new Date(past[0]) : undefined;
}

/** Quantos horários caem em [rangeStart, rangeEnd). */
export function countStartsInRange(
  startsAt: readonly string[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const from = rangeStart.getTime();
  const to = rangeEnd.getTime();
  return startsAt.filter((value) => {
    const t = new Date(value).getTime();
    return t >= from && t < to;
  }).length;
}
