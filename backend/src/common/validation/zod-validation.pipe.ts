import { PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import type { ZodType } from 'zod';

// How many problems go into the error message; the rest are cut so the message stays short.
const MAX_ISSUES = 3;

// Checks a request body, query or param against a Zod schema.
// Usage: @Body(new ZodValidationPipe(schema)) body: z.infer<typeof schema>
// On success returns the parsed value (unknown keys removed by the schema);
// on failure answers 422 { "error": { "code": "VALIDATION_ERROR", "message": "field: problem" } }.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    // Only field paths and Zod's own texts go into the message, never the input values.
    const message = result.error.issues
      .slice(0, MAX_ISSUES)
      .map((issue) => {
        const path = issue.path.map(String).join('.');
        return path === '' ? issue.message : `${path}: ${issue.message}`;
      })
      .join('; ');

    throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message });
  }
}
