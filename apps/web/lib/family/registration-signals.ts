/**
 * O que o coach lê numa inscrição sobre a família.
 *
 * Datas iguais significam que a ficha nasceu nesta inscrição: `now()` é o
 * mesmo dentro da transação. Data anterior significa que a pessoa já estava
 * no clube. Login é o estado de agora, não o de quando a inscrição entrou.
 */

export type FamilySignals = {
  athleteKnown: boolean;
  guardianKnown: boolean;
  hasLogin: boolean;
};

export function registrationFamilySignals(input: {
  athleteCreatedAt: string | null;
  registrationCreatedAt: string;
  guardianCreatedAt: string | null;
  athleteUserId: string | null;
  guardianUserId: string | null;
}): FamilySignals {
  return {
    athleteKnown: isEarlier(input.athleteCreatedAt, input.registrationCreatedAt),
    guardianKnown: isEarlier(input.guardianCreatedAt, input.registrationCreatedAt),
    hasLogin: Boolean(input.athleteUserId || input.guardianUserId),
  };
}

function isEarlier(earlier: string | null, later: string): boolean {
  if (!earlier) return false;
  const a = Date.parse(earlier);
  const b = Date.parse(later);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a < b;
}
