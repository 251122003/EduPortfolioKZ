// Kazakhstan IIN (individual identification number): 12 digits.
// Digits 1-6: birth date YYMMDD. Digit 7: century and sex (1-2: 1800s, 3-4: 1900s, 5-6: 2000s).
// Digits 8-11: serial number. Digit 12: check digit.

const FIRST_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SECOND_WEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

const CENTURY_BY_DIGIT: Readonly<Record<string, number>> = {
  '1': 1800,
  '2': 1800,
  '3': 1900,
  '4': 1900,
  '5': 2000,
  '6': 2000,
};

/** Removes spaces and dashes that people type between digit groups. */
export function normalizeIin(input: string): string {
  return input.replace(/[\s-]/g, '');
}

/**
 * Computes the 12th digit from the first 11 digits.
 * Returns null when the number cannot have a valid check digit (both passes give 10).
 */
export function iinCheckDigit(first11: string): number | null {
  if (!/^\d{11}$/.test(first11)) {
    throw new Error('iinCheckDigit expects exactly 11 digits');
  }
  const digits = first11.split('').map(Number);
  const weightedSum = (weights: number[]): number =>
    digits.reduce((sum, digit, i) => sum + digit * weights[i], 0) % 11;

  const first = weightedSum(FIRST_WEIGHTS);
  if (first !== 10) {
    return first;
  }
  const second = weightedSum(SECOND_WEIGHTS);
  return second === 10 ? null : second;
}

/** Birth date encoded in the IIN, or null if the date part is impossible. */
export function birthDateFromIin(iin: string): Date | null {
  if (!/^\d{12}$/.test(iin)) {
    return null;
  }
  const century = CENTURY_BY_DIGIT[iin[6]];
  if (century === undefined) {
    return null;
  }
  const year = century + Number(iin.slice(0, 2));
  const month = Number(iin.slice(2, 4));
  const day = Number(iin.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 31 February into March, so compare the parts back.
  const sameDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return sameDate ? date : null;
}

/** True when the input is a well-formed IIN: 12 digits, a real birth date and a correct check digit. */
export function isValidIin(input: string): boolean {
  const iin = normalizeIin(input);
  if (!/^\d{12}$/.test(iin) || birthDateFromIin(iin) === null) {
    return false;
  }
  return iinCheckDigit(iin.slice(0, 11)) === Number(iin[11]);
}

/** True when the person was under 18 on the given day (UC-1 step 3: guardian consent). */
export function isMinor(iin: string, today: Date = new Date()): boolean {
  const birth = birthDateFromIin(iin);
  if (birth === null) {
    throw new Error('isMinor needs a valid IIN');
  }
  const eighteenth = new Date(
    Date.UTC(birth.getUTCFullYear() + 18, birth.getUTCMonth(), birth.getUTCDate()),
  );
  return today < eighteenth;
}
