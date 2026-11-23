import { ru } from './ru';

/** Current UI texts. When kk is added, this will pick the dictionary by language. */
export const t = ru;

type ErrorCode = keyof typeof ru.errors;

function isKnownErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(t.errors, code);
}

/** User-facing text for an API error code; unknown codes get a generic text. */
export function errorText(code: string): string {
  return isKnownErrorCode(code) ? t.errors[code] : t.errors.UNKNOWN;
}
