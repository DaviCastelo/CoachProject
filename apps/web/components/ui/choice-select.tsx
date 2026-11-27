'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ChoiceOption = Readonly<{
  value: string;
  label: string;
  disabled?: boolean;
}>;

type ChoiceSelectProps = Readonly<{
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  placeholder?: string;
  /** Texto do campo fechado quando difere do item da lista ("Feb" para "February"). */
  valueLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}>;

/*
 * O Radix recusa item com valor vazio (é o valor que ele usa para "nada
 * escolhido"). Opção vazia, como "Nenhum formulário", vira esta sentinela na
 * ida e volta a ser '' na volta: quem usa o componente só enxerga ''.
 */
const EMPTY = '__empty__';

export function ChoiceSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  valueLabel,
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: ChoiceSelectProps) {
  // Vazio mostra o placeholder quando há um ("Select…" no formulário da
  // família: "No answer" ali parecia resposta dada). Sem placeholder, mostra o
  // rótulo da opção vazia, como "No form" no painel.
  const hasEmpty = options.some((o) => o.value === '');
  const radixValue = value === '' && hasEmpty && !placeholder ? EMPTY : value;
  const selected = options.find((o) => o.value === value);
  const shown =
    radixValue === '' ? undefined : (valueLabel ?? selected?.label ?? (value || undefined));

  return (
    <Select
      value={radixValue}
      onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={className}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
      >
        {/* O texto vai pronto: sozinho, o Radix só preenche o campo depois de
            montar no navegador, e até lá "Published" aparecia em branco. */}
        <SelectValue placeholder={placeholder}>{shown}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY}
            value={option.value === '' ? EMPTY : option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
