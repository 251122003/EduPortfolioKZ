import { birthDateFromIin, iinCheckDigit, isMinor, isValidIin, normalizeIin } from './iin.js';

// Builds a synthetic IIN with a correct check digit. Tests use only synthetic data.
function makeIin(first11: string): string {
  const check = iinCheckDigit(first11);
  if (check === null) {
    throw new Error(`no valid check digit for ${first11}`);
  }
  return `${first11}${check}`;
}

describe('IIN', () => {
  const born2008 = makeIin('08031550012'); // 15 March 2008, 2000s century digit 5
  const born1999 = makeIin('99123140045'); // 31 December 1999, 1900s century digit 4

  it('accepts a synthetic IIN with a correct check digit', () => {
    expect(isValidIin(born2008)).toBe(true);
    expect(isValidIin(born1999)).toBe(true);
  });

  it('accepts spaces and dashes between digit groups', () => {
    const spaced = `${born2008.slice(0, 6)} ${born2008.slice(6, 9)}-${born2008.slice(9)}`;
    expect(normalizeIin(spaced)).toBe(born2008);
    expect(isValidIin(spaced)).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    const wrong = born2008.slice(0, 11) + String((Number(born2008[11]) + 1) % 10);
    expect(isValidIin(wrong)).toBe(false);
  });

  it('rejects wrong length, letters and impossible dates', () => {
    expect(isValidIin('12345')).toBe(false);
    expect(isValidIin('08031550012A')).toBe(false);
    expect(isValidIin(makeIin('08023050012'))).toBe(false); // 30 February
    expect(isValidIin(makeIin('08031590012'))).toBe(false); // century digit 9
  });

  it('uses the second set of weights when the first sum gives 10', () => {
    // Only digit 10 is 1: first pass 1*10 = 10, so the second pass is used: 1*1 = 1.
    expect(iinCheckDigit('00000000010')).toBe(1);
  });

  it('reads the birth date and century', () => {
    expect(birthDateFromIin(born2008)?.toISOString().slice(0, 10)).toBe('2008-03-15');
    expect(birthDateFromIin(born1999)?.toISOString().slice(0, 10)).toBe('1999-12-31');
  });

  it('tells minors from adults', () => {
    const today = new Date(Date.UTC(2026, 2, 14)); // one day before the 18th birthday
    expect(isMinor(born2008, today)).toBe(true);
    expect(isMinor(born2008, new Date(Date.UTC(2026, 2, 15)))).toBe(false);
    expect(isMinor(born1999, today)).toBe(false);
  });
});
