import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { apiError, type ApiErrorBody } from './api-error.js';

// Codes for the statuses the API uses. Other statuses fall back to the HttpStatus name.
const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function codeForStatus(status: number): string {
  const known = CODE_BY_STATUS[status];
  if (known !== undefined) {
    return known;
  }
  const name: unknown = (HttpStatus as Record<number, unknown>)[status];
  return typeof name === 'string' ? name : 'ERROR';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Reads code and message from what an HttpException carries: a plain string,
// Nest's default { message, error, statusCode }, or our own { code, message, attemptsLeft? }.
function bodyFromHttpException(exception: HttpException): ApiErrorBody {
  const status = exception.getStatus();
  const response: unknown = exception.getResponse();

  let code = codeForStatus(status);
  let message = exception.message;
  let attemptsLeft: number | undefined;

  if (typeof response === 'string') {
    message = response;
  } else if (isRecord(response)) {
    if (typeof response.code === 'string') {
      code = response.code;
    }
    const raw = response.message;
    if (typeof raw === 'string') {
      message = raw;
    } else if (Array.isArray(raw)) {
      message = raw.filter((item): item is string => typeof item === 'string').join('; ');
    }
    if (typeof response.attemptsLeft === 'number') {
      attemptsLeft = response.attemptsLeft;
    }
  }

  return apiError(code, message, attemptsLeft);
}

// Turns every error into { "error": { "code", "message" } }.
// Unknown errors become 500 with a fixed message, so no internal details reach the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(bodyFromHttpException(exception));
      return;
    }

    // Log only the error class and the route. The error text and the query string
    // may contain personal data (IIN, phone), so they are never written to the log.
    const request = http.getRequest<Request>();
    const errorName = exception instanceof Error ? exception.name : typeof exception;
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    this.logger.error(`Unhandled ${errorName} on ${request.method} ${path}`);

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(apiError('INTERNAL_ERROR', 'Internal server error'));
  }
}
