'use client';

import * as React from 'react';
import { DateSelect } from '@/components/ui/date-select';
import { TimeSelect } from '@/components/ui/time-select';
import { composeLocalDateTime, splitLocalDateTime } from '@/lib/date-parts';

type DateTimeSelectProps = Readonly<{
  id?: string;
  /** `YYYY-MM-DDTHH:mm` (o formato de `datetime-local`), ou '' se incompleto. */
  value: string;
  onChange: (value: string) => void;
}>;

/**
 * Data e hora para a agenda, no lugar do `datetime-local` do navegador.
 * Guarda as duas metades separadas: escolher a data sem a hora ainda não é um
 * valor, mas também não pode apagar a data já escolhida.
 */
export function DateTimeSelect({ id, value, onChange }: DateTimeSelectProps) {
  const [parts, setParts] = React.useState(() => splitLocalDateTime(value));

  React.useEffect(() => {
    const current = composeLocalDateTime(parts.date, parts.time);
    if (value === current) return;
    if (value === '' && current === '') return;
    setParts(splitLocalDateTime(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(next: { date: string; time: string }) {
    setParts(next);
    onChange(composeLocalDateTime(next.date, next.time));
  }

  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <DateSelect
        id={id}
        value={parts.date}
        onChange={(date) => update({ ...parts, date })}
        minYear={year - 1}
        maxYear={year + 2}
        yearOrder="asc"
        className="sm:flex-[3]"
      />
      <TimeSelect
        value={parts.time}
        onChange={(time) => update({ ...parts, time })}
        className="sm:flex-1"
      />
    </div>
  );
}
