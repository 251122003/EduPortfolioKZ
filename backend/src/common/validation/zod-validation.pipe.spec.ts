import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    title: z.string().min(1),
    year: z.number().int(),
  });
  const pipe = new ZodValidationPipe(schema);

  // Runs the pipe and returns the thrown exception, so the test can look inside it.
  function errorFor(value: unknown): UnprocessableEntityException {
    try {
      pipe.transform(value);
    } catch (error: unknown) {
      if (error instanceof UnprocessableEntityException) {
        return error;
      }
      throw error;
    }
    throw new Error('expected the pipe to throw');
  }

  it('returns parsed data and drops unknown keys', () => {
    expect(pipe.transform({ title: 'Olympiad', year: 2026, extra: true })).toEqual({
      title: 'Olympiad',
      year: 2026,
    });
  });

  it('answers 422 VALIDATION_ERROR with the field path', () => {
    const error = errorFor({ title: '', year: 2026 });
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(error.message).toMatch(/^title: /);
  });

  it('lists several problems and never echoes the input value', () => {
    const error = errorFor({ title: '', year: '000000000000' });
    expect(error.message).toContain('title: ');
    expect(error.message).toContain('year: ');
    expect(error.message).not.toContain('000000000000');
  });

  it('reports a problem with the whole value without a path', () => {
    const error = errorFor(null);
    expect(error.message).not.toMatch(/^: /);
    expect(error.message.length).toBeGreaterThan(0);
  });
});
