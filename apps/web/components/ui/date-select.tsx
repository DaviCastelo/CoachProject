'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { ChoiceSelect, type ChoiceOption } from '@/components/ui/choice-select';
import { cn } from '@/lib/utils';
import { composeIsoDate, daysInMonth, splitIsoDate, type DateParts } from '@/lib/date-parts';

type DateSelectProps = Readonly<{
  /** Vai para o primeiro campo, para o `<Label htmlFor>` apontar para ele. */
  id?: string;
  /** `YYYY-MM-DD`, ou '' enquanto a data não está completa. */
  value: string;
  onChange: (value: string) => void;
  minYear: number;
  maxYear: number;
  /** Data de nascimento abre no ano mais recente; agenda, no mais antigo. */
  yearOrder?: 'asc' | 'desc';
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  /** Rótulo do campo ("Date of birth"): o leitor de tela anuncia o grupo antes de "Month". */
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}>;

/*
 * Data em três listas: mês, dia e ano, na ordem do idioma.
 *
 * O `<input type="date">` abre o calendário do navegador, que segue o idioma
 * do sistema e não o do site: num Chrome em português, a família americana
 * via "fevereiro de 2014", "Limpar" e "Hoje" com o site em inglês. Para data
 * de nascimento o calendário ainda obriga a voltar mês a mês até 2014.
 */
export function DateSelect({
  id,
  value,
  onChange,
  minYear,
  maxYear,
  yearOrder = 'desc',
  clearable = false,
  invalid,
  disabled,
  className,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: DateSelectProps) {
  const locale = useLocale();
  const t = useTranslations('dateSelect');
  const [parts, setParts] = React.useState<DateParts>(() => splitIsoDate(value));

  // Valor vindo de fora (atleta já cadastrado, formulário reiniciado). Data
  // pela metade não volta como valor, então '' com as partes incompletas é o
  // próprio componente esperando o resto, e não pode apagar o que já foi escolhido.
  React.useEffect(() => {
    const current = composeIsoDate(parts);
    if (value === current) return;
    if (value === '' && current === '') return;
    setParts(splitIsoDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(next: DateParts) {
    const max = daysInMonth(next.year, next.month);
    const day = next.day && Number(next.day) > max ? String(max) : next.day;
    const fixed = { ...next, day };
    setParts(fixed);
    onChange(composeIsoDate(fixed));
  }

  const monthOptions: ChoiceOption[] = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(new Date(Date.UTC(2000, i, 1)));
      return { value: String(i + 1), label: name.charAt(0).toUpperCase() + name.slice(1) };
    });
  }, [locale]);

  // Nome curto no campo fechado: três listas lado a lado no celular não
  // comportam "September", e "Sep" é como o americano escreve data.
  const shortMonth = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    return (month: string) => {
      if (!month) return undefined;
      const name = fmt.format(new Date(Date.UTC(2000, Number(month) - 1, 1))).replace('.', '');
      return name.charAt(0).toUpperCase() + name.slice(1);
    };
  }, [locale]);

  const dayOptions: ChoiceOption[] = Array.from(
    { length: daysInMonth(parts.year, parts.month) },
    (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
  );

  const yearOptions: ChoiceOption[] = React.useMemo(() => {
    const years: ChoiceOption[] = [];
    for (let y = minYear; y <= maxYear; y += 1) years.push({ value: String(y), label: String(y) });
    return yearOrder === 'desc' ? years.reverse() : years;
  }, [minYear, maxYear, yearOrder]);

  type Part = 'month' | 'day' | 'year';
  const config: Record<Part, { options: ChoiceOption[]; flex: string }> = {
    month: { options: monthOptions, flex: 'flex-[1.4]' },
    day: { options: dayOptions, flex: 'flex-1' },
    year: { options: yearOptions, flex: 'flex-[1.1]' },
  };

  // Mês antes do dia é o jeito americano; português e espanhol escrevem o dia primeiro.
  const order: Part[] = locale.startsWith('en') ? ['month', 'day', 'year'] : ['day', 'month', 'year'];

  const hasAny = Boolean(parts.year || parts.month || parts.day);

  return (
    <div
      role="group"
      aria-labelledby={ariaLabelledBy}
      className={cn('flex items-center gap-1.5 sm:gap-2', className)}
    >
      {order.map((part, index) => (
        <ChoiceSelect
          key={part}
          id={index === 0 ? id : undefined}
          value={parts[part]}
          onValueChange={(next) => update({ ...parts, [part]: next })}
          options={config[part].options}
          placeholder={t(part)}
          aria-label={t(part)}
          invalid={invalid}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          valueLabel={part === 'month' ? shortMonth(parts.month) : undefined}
          className={cn('min-w-0 gap-1 px-2.5 sm:px-3', config[part].flex)}
        />
      ))}
      {clearable && hasAny && !disabled ? (
        <button
          type="button"
          onClick={() => update({ year: '', month: '', day: '' })}
          className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('clear')}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
