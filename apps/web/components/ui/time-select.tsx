'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChoiceSelect, type ChoiceOption } from '@/components/ui/choice-select';

type TimeSelectProps = Readonly<{
  id?: string;
  /** `HH:mm` em 24 horas, ou ''. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}>;

/* Treino de base não começa antes das 5h: a lista abre perto do que importa. */
const FIRST_HOUR = 5;
const STEP_MINUTES = 15;

/**
 * Horário em lista de 15 em 15 minutos, escrito no formato do idioma
 * ("9:00 AM" em inglês, "09:00" em português). Um horário fora da grade, de
 * um treino antigo, entra na lista para não sumir da tela.
 */
export function TimeSelect({ id, value, onChange, className, disabled }: TimeSelectProps) {
  const locale = useLocale();
  const t = useTranslations('dateSelect');

  const options: ChoiceOption[] = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    const label = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return fmt.format(new Date(Date.UTC(2000, 0, 1, h, m)));
    };
    const values: string[] = [];
    for (let minutes = FIRST_HOUR * 60; minutes < 24 * 60; minutes += STEP_MINUTES) {
      const h = String(Math.floor(minutes / 60)).padStart(2, '0');
      const m = String(minutes % 60).padStart(2, '0');
      values.push(`${h}:${m}`);
    }
    if (value && !values.includes(value)) values.push(value);
    return values.sort().map((v) => ({ value: v, label: label(v) }));
  }, [locale, value]);

  return (
    <ChoiceSelect
      id={id}
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={t('time')}
      aria-label={t('time')}
      className={className}
      disabled={disabled}
    />
  );
}
