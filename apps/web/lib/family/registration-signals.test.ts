import { describe, expect, it } from 'vitest';
import { registrationFamilySignals } from './registration-signals';

const registered = '2026-10-12T18:00:00.000Z';

describe('registrationFamilySignals', () => {
  it('datas iguais são ficha nova, sem login', () => {
    expect(
      registrationFamilySignals({
        athleteCreatedAt: registered,
        registrationCreatedAt: registered,
        guardianCreatedAt: registered,
        athleteUserId: null,
        guardianUserId: null,
      }),
    ).toEqual({ athleteKnown: false, guardianKnown: false, hasLogin: false });
  });

  it('data anterior marca atleta e responsável que já estavam no clube', () => {
    expect(
      registrationFamilySignals({
        athleteCreatedAt: '2026-01-01T00:00:00.000Z',
        registrationCreatedAt: registered,
        guardianCreatedAt: '2026-01-01T00:00:00.000Z',
        athleteUserId: null,
        guardianUserId: null,
      }),
    ).toMatchObject({ athleteKnown: true, guardianKnown: true, hasLogin: false });
  });

  it('login do atleta ou do responsável conta', () => {
    expect(
      registrationFamilySignals({
        athleteCreatedAt: registered,
        registrationCreatedAt: registered,
        guardianCreatedAt: null,
        athleteUserId: null,
        guardianUserId: 'user-1',
      }).hasLogin,
    ).toBe(true);
    expect(
      registrationFamilySignals({
        athleteCreatedAt: registered,
        registrationCreatedAt: registered,
        guardianCreatedAt: null,
        athleteUserId: 'user-2',
        guardianUserId: null,
      }).hasLogin,
    ).toBe(true);
  });
});
