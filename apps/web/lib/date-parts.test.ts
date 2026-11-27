import { describe, expect, it } from 'vitest';
import {
  composeIsoDate,
  composeLocalDateTime,
  daysInMonth,
  splitIsoDate,
  splitLocalDateTime,
} from './date-parts';

describe('splitIsoDate / composeIsoDate', () => {
  it('vai e volta sem perder nada', () => {
    expect(splitIsoDate('2014-02-20')).toEqual({ year: '2014', month: '2', day: '20' });
    expect(composeIsoDate({ year: '2014', month: '2', day: '5' })).toBe('2014-02-05');
  });

  it('ignora a hora de um timestamp', () => {
    expect(splitIsoDate('2015-05-10T00:00:00Z')).toEqual({ year: '2015', month: '5', day: '10' });
  });

  it('data pela metade não vira data', () => {
    expect(composeIsoDate({ year: '2014', month: '', day: '20' })).toBe('');
    expect(splitIsoDate('')).toEqual({ year: '', month: '', day: '' });
    expect(splitIsoDate('20/02/2014')).toEqual({ year: '', month: '', day: '' });
  });
});

describe('daysInMonth', () => {
  it('conhece fevereiro de ano bissexto', () => {
    expect(daysInMonth('2016', '2')).toBe(29);
    expect(daysInMonth('2015', '2')).toBe(28);
  });

  it('não corta o dia antes de saber mês e ano', () => {
    expect(daysInMonth('', '')).toBe(31);
    expect(daysInMonth('', '2')).toBe(29);
    expect(daysInMonth('2015', '4')).toBe(30);
  });
});

describe('splitLocalDateTime / composeLocalDateTime', () => {
  it('separa e junta data e hora', () => {
    expect(splitLocalDateTime('2026-12-19T09:00')).toEqual({ date: '2026-12-19', time: '09:00' });
    expect(composeLocalDateTime('2026-12-19', '09:00')).toBe('2026-12-19T09:00');
  });

  it('sem uma das partes fica vazio', () => {
    expect(composeLocalDateTime('', '09:00')).toBe('');
    expect(composeLocalDateTime('2026-12-19', '')).toBe('');
  });
});
