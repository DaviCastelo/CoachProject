import { describe, expect, it } from 'vitest';
import {
  addDays,
  bucketize,
  cumulativeComparison,
  daysBetween,
  foldRanked,
  isPeriodKey,
  niceTicks,
  percentChange,
  projectMonth,
  ratio,
  resolvePeriod,
  todayInTimeZone,
} from './index';

describe('todayInTimeZone', () => {
  it('usa o dia do clube, não o de UTC', () => {
    const lateNight = new Date('2026-04-01T01:00:00Z');
    expect(todayInTimeZone('America/New_York', lateNight)).toBe('2026-03-31');
    expect(todayInTimeZone('UTC', lateNight)).toBe('2026-04-01');
  });
});

describe('isPeriodKey', () => {
  it('aceita só os períodos conhecidos', () => {
    expect(isPeriodKey('90d')).toBe(true);
    expect(isPeriodKey('tudo')).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
  });
});

describe('resolvePeriod', () => {
  it('este mês vai até hoje e compara com o mesmo ponto do mês anterior', () => {
    const p = resolvePeriod('month', '2026-03-10');
    expect([p.from, p.to]).toEqual(['2026-03-01', '2026-03-10']);
    expect([p.prevFrom, p.prevTo]).toEqual(['2026-02-01', '2026-02-10']);
    expect(p.axisTo).toBe('2026-03-31');
    expect(p.prevAxisTo).toBe('2026-02-28');
  });

  /* 31 de março não existe em fevereiro. */
  it('não passa do fim de um mês mais curto', () => {
    expect(resolvePeriod('month', '2026-03-31').prevTo).toBe('2026-02-28');
  });

  it('atravessa a virada do ano', () => {
    const p = resolvePeriod('month', '2026-01-15');
    expect([p.prevFrom, p.prevTo]).toEqual(['2025-12-01', '2025-12-15']);
  });

  it('mês passado compara mês inteiro com mês inteiro', () => {
    const p = resolvePeriod('last_month', '2026-03-10');
    expect([p.from, p.to]).toEqual(['2026-02-01', '2026-02-28']);
    expect([p.prevFrom, p.prevTo]).toEqual(['2026-01-01', '2026-01-31']);
  });

  it('90 dias contam hoje e não sobrepõem o período anterior', () => {
    const p = resolvePeriod('90d', '2026-03-31');
    expect(daysBetween(p.from, p.to) + 1).toBe(90);
    expect(daysBetween(p.prevFrom, p.prevTo) + 1).toBe(90);
    expect(addDays(p.prevTo, 1)).toBe(p.from);
    expect(p.granularity).toBe('week');
  });

  it('12 meses agrupam por mês', () => {
    expect(resolvePeriod('12m', '2026-03-31').granularity).toBe('month');
  });
});

describe('percentChange', () => {
  it('calcula alta e queda', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it('não inventa porcentagem sem base', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe('ratio', () => {
  it('sem o todo não existe taxa', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });
});

describe('cumulativeComparison', () => {
  const period = resolvePeriod('month', '2026-03-03');
  const points = [
    { day: '2026-02-01', value: 10 },
    { day: '2026-02-28', value: 5 },
    { day: '2026-03-01', value: 100 },
    { day: '2026-03-03', value: 50 },
  ];
  const series = cumulativeComparison(points, period);

  it('acumula o período atual', () => {
    expect(series[0].current).toBe(100);
    expect(series[1].current).toBe(100);
    expect(series[2].current).toBe(150);
  });

  it('para no dia de hoje, sem riscar o futuro', () => {
    expect(series[3].current).toBeNull();
    expect(series).toHaveLength(31);
  });

  it('a linha anterior segue até o fim do mês dela', () => {
    expect(series[27].previous).toBe(15);
    expect(series[27].prevDay).toBe('2026-02-28');
  });

  it('fevereiro acaba antes de março', () => {
    expect(series[28].previous).toBeNull();
    expect(series[28].prevDay).toBeNull();
  });

  it('não mistura os dois períodos', () => {
    expect(series[0].previous).toBe(10);
  });
});

describe('bucketize', () => {
  const points = [
    { day: '2026-03-01', value: 1 },
    { day: '2026-03-08', value: 2 },
    { day: '2026-04-02', value: 4 },
  ];

  it('preenche dia sem movimento com zero', () => {
    const days = bucketize(points, '2026-03-01', '2026-03-03', 'day');
    expect(days.map((b) => b.value)).toEqual([1, 0, 0]);
  });

  it('semanas somam sete dias a partir do início', () => {
    const weeks = bucketize(points, '2026-03-01', '2026-03-14', 'week');
    expect(weeks.map((b) => b.value)).toEqual([1, 2]);
  });

  it('corta o último balde no fim do período', () => {
    const weeks = bucketize(points, '2026-03-01', '2026-03-09', 'week');
    expect(weeks[1].end).toBe('2026-03-09');
  });

  it('meses seguem o calendário, mesmo começando no meio', () => {
    const months = bucketize(points, '2026-03-15', '2026-04-10', 'month');
    expect(months.map((b) => [b.start, b.end])).toEqual([
      ['2026-03-15', '2026-03-31'],
      ['2026-04-01', '2026-04-10'],
    ]);
    expect(months[1].value).toBe(4);
  });

  it('não perde nem duplica nada no total', () => {
    const total = bucketize(points, '2026-03-01', '2026-04-30', 'week').reduce(
      (sum, b) => sum + b.value,
      0,
    );
    expect(total).toBe(7);
  });
});

describe('foldRanked', () => {
  it('mantém os maiores e soma o resto', () => {
    const folded = foldRanked(
      [
        { key: 'a', value: 1 },
        { key: 'b', value: 5 },
        { key: 'c', value: 3 },
      ],
      2,
    );
    expect(folded.items.map((i) => i.key)).toEqual(['b', 'c']);
    expect(folded.otherValue).toBe(1);
  });

  it('não mexe na lista original', () => {
    const items = [
      { key: 'a', value: 1 },
      { key: 'b', value: 5 },
    ];
    foldRanked(items, 1);
    expect(items[0].key).toBe('a');
  });
});

describe('niceTicks', () => {
  it('usa números redondos e cobre o máximo', () => {
    expect(niceTicks(9000)).toEqual([0, 2500, 5000, 7500, 10000]);
  });

  it('o topo nunca fica abaixo do maior valor', () => {
    for (const max of [1, 7, 33, 1234, 69850, 999999]) {
      const ticks = niceTicks(max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('contagem nunca tem marca quebrada', () => {
    expect(niceTicks(1, 4, true)).toEqual([0, 1]);
    expect(niceTicks(3, 4, true)).toEqual([0, 1, 2, 3]);
    for (const max of [1, 2, 3, 7, 11, 45]) {
      expect(niceTicks(max, 4, true).every(Number.isInteger), String(max)).toBe(true);
    }
  });

  it('sem dados ainda desenha um eixo', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('projectMonth', () => {
  it('projeta pelo ritmo dos dias que já passaram', () => {
    const period = resolvePeriod('month', '2026-04-10');
    expect(projectMonth(10000, '2026-04-10', period)).toBe(30000);
  });

  it('não projeta com menos de uma semana de mês', () => {
    const period = resolvePeriod('month', '2026-04-06');
    expect(projectMonth(10000, '2026-04-06', period)).toBeNull();
  });

  it('projeta a partir do sétimo dia', () => {
    const period = resolvePeriod('month', '2026-04-07');
    expect(projectMonth(7000, '2026-04-07', period)).toBe(30000);
  });

  it('só existe para o mês corrente', () => {
    const period = resolvePeriod('last_month', '2026-04-10');
    expect(projectMonth(10000, '2026-04-10', period)).toBeNull();
  });
});
