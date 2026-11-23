import { describe, expect, it } from 'vitest';
import { errorText } from './index';

describe('errorText', () => {
  it('returns the text for a known code', () => {
    expect(errorText('INVALID_CREDENTIALS')).toBe('Неверный логин или пароль');
  });

  it('falls back to the generic text for an unknown code', () => {
    expect(errorText('SOMETHING_NEW')).toBe('Что-то пошло не так. Попробуйте ещё раз');
    expect(errorText('toString')).toBe('Что-то пошло не так. Попробуйте ещё раз');
  });
});
