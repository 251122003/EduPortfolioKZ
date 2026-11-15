import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

// A fake HTTP context: records the status and JSON body the filter sends.
function fakeHost(url = '/awards?iin=000000000000'): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const request = { method: 'POST', url, originalUrl: url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it('turns NotFoundException into 404 NOT_FOUND', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new NotFoundException('Award not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'Award not found' } });
  });

  it('keeps the status and message of ServiceUnavailableException', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new ServiceUnavailableException('Database is unavailable'), host);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' },
    });
  });

  it('uses the code given inside the exception', () => {
    const { host, json } = fakeHost();
    filter.catch(new ConflictException({ code: 'AWARD_EXISTS', message: 'Already added' }), host);
    expect(json).toHaveBeenCalledWith({ error: { code: 'AWARD_EXISTS', message: 'Already added' } });
  });

  it('passes attemptsLeft through when the exception has it', () => {
    const { host, json } = fakeHost();
    filter.catch(
      new BadRequestException({ code: 'OTP_INVALID', message: 'Wrong code', attemptsLeft: 2 }),
      host,
    );
    expect(json).toHaveBeenCalledWith({
      error: { code: 'OTP_INVALID', message: 'Wrong code', attemptsLeft: 2 },
    });
  });

  it('joins a list of messages', () => {
    const { host, json } = fakeHost();
    filter.catch(new BadRequestException(['name is empty', 'date is wrong']), host);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'name is empty; date is wrong' },
    });
  });

  it('accepts an exception built from a plain string', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new HttpException('Locked', HttpStatus.LOCKED), host);
    expect(status).toHaveBeenCalledWith(423);
    expect(json).toHaveBeenCalledWith({ error: { code: 'LOCKED', message: 'Locked' } });
  });

  it('falls back to ERROR for a status without a name', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new HttpException({ reason: 'none' }, 499), host);
    expect(status).toHaveBeenCalledWith(499);
    expect(json).toHaveBeenCalledWith({ error: { code: 'ERROR', message: 'Http Exception' } });
  });

  it('hides unknown errors behind 500 and logs no details', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new Error('secret db password 000000000000'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });

    const logged = JSON.stringify(logError.mock.calls);
    expect(logged).toContain('POST /awards');
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain('000000000000');
  });

  it('handles a thrown value that is not an Error', () => {
    const { host, status } = fakeHost('/health');
    filter.catch('just a string', host);
    expect(status).toHaveBeenCalledWith(500);
  });
});
