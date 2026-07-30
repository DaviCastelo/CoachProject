/**
 * Returns the US youth soccer age group (U#) for a date of birth.
 * Convention: age group increments in August (start of soccer year).
 */
export function athleteAgeGroup(dob: Date, ref: Date = new Date()): string {
  const birthYear = dob.getFullYear();
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth() + 1; // 1-indexed

  const soccerYearOffset = refMonth >= 8 ? 1 : 0;
  const ageGroup = refYear - birthYear + soccerYearOffset;

  return `U${ageGroup}`;
}

/**
 * Returns the athlete's age in years at a reference date.
 */
export function athleteAge(dob: Date, ref: Date = new Date()): number {
  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
