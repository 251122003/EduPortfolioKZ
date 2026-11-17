import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

// Errors of the registration flow. Messages never contain IIN, phone or the code.
// The client shows its own kk/ru text chosen by `code`.

export function otpExpired(): HttpException {
  return new GoneException({
    code: 'OTP_EXPIRED',
    message: 'Code expired or not found, request a new one',
  });
}

export function otpLocked(): HttpException {
  return new HttpException(
    { code: 'OTP_LOCKED', message: 'Too many wrong attempts, try again in 15 minutes' },
    HttpStatus.LOCKED,
  );
}

export function otpInvalid(attemptsLeft: number): HttpException {
  return new BadRequestException({
    code: 'OTP_INVALID',
    message: `Wrong code, attempts left: ${attemptsLeft}`,
    attemptsLeft,
  });
}

export function tooManyCodes(): HttpException {
  return new HttpException(
    { code: 'TOO_MANY_REQUESTS', message: 'Too many codes requested, try again later' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

// UC-1: the IIN matches an organizer's record, but the name or phone does not.
// The text is the same for every reason, so it does not tell which field differs.
export function studentDataMismatch(): HttpException {
  return new ConflictException({
    code: 'STUDENT_DATA_MISMATCH',
    message: "Data does not match the organizer's record, contact the organizer",
  });
}

// Login: one answer for an unknown user and a wrong password, so neither is revealed.
export function invalidCredentials(): HttpException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Wrong login or password',
  });
}

// No session cookie, or the token is invalid or expired.
export function notSignedIn(): HttpException {
  return new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Sign in required' });
}

// Signed in, but the role is not allowed here.
export function forbidden(): HttpException {
  return new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
}
