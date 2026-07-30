import { describe, it, expect } from 'vitest';
import { athleteAgeGroup, athleteAge } from './age-group';

describe('athleteAgeGroup', () => {
  it('returns U12 for a child born May 2014 in July 2026', () => {
    const dob = new Date(2014, 4, 1); // May 2014
    const ref = new Date(2026, 6, 15); // July 2026
    expect(athleteAgeGroup(dob, ref)).toBe('U12');
  });

  it('increments age group in August (soccer year boundary)', () => {
    const dob = new Date(2014, 4, 1); // May 2014
    const july = new Date(2026, 6, 15); // July 2026
    const august = new Date(2026, 7, 1); // August 2026
    expect(athleteAgeGroup(dob, july)).toBe('U12');
    expect(athleteAgeGroup(dob, august)).toBe('U13');
  });

  it('handles year boundary in December', () => {
    const dob = new Date(2010, 0, 1);
    const ref = new Date(2026, 11, 31);
    expect(athleteAgeGroup(dob, ref)).toBe('U17');
  });

  it('handles newborn in current year before August', () => {
    const dob = new Date(2026, 2, 1); // March 2026
    const ref = new Date(2026, 5, 1); // June 2026
    expect(athleteAgeGroup(dob, ref)).toBe('U0');
  });
});

describe('athleteAge', () => {
  it('calculates age correctly', () => {
    const dob = new Date(2015, 4, 1);
    const ref = new Date(2026, 6, 30);
    expect(athleteAge(dob, ref)).toBe(11);
  });

  it('handles birthday not yet reached this year', () => {
    const dob = new Date(2015, 11, 25); // Dec 25
    const ref = new Date(2026, 0, 1); // Jan 1
    expect(athleteAge(dob, ref)).toBe(10);
  });
});
