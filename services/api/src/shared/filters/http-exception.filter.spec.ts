import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const makeHost = (req: Record<string, unknown>): ArgumentsHost => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warn (not error) for a 400 BadRequestException, including method/path/status/message', () => {
    const host = makeHost({ method: 'POST', url: '/v1/onboarding', user: { userId: 'user-123' } });

    filter.catch(new BadRequestException('Invalid onboarding payload'), host);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0];
    expect(line).toContain('POST');
    expect(line).toContain('/v1/onboarding');
    expect(line).toContain('400');
    expect(line).toContain('Invalid onboarding payload');
    expect(line).toContain('user-123');

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid onboarding payload' }),
    );
  });

  it('joins class-validator message arrays and logs the joined string at warn level', () => {
    const host = makeHost({ method: 'POST', url: '/v1/auth/register' });

    filter.catch(
      new HttpException(
        { message: ['email must be an email', 'password is too short'], statusCode: 400 },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0];
    expect(line).toContain('email must be an email; password is too short');

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'email must be an email; password is too short',
      }),
    );
  });

  it('logs a warn (not error) for a 422 HttpException', () => {
    const host = makeHost({ method: 'PATCH', url: '/v1/participants/42' });

    filter.catch(
      new HttpException('Unprocessable entity', HttpStatus.UNPROCESSABLE_ENTITY),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0];
    expect(line).toContain('PATCH');
    expect(line).toContain('/v1/participants/42');
    expect(line).toContain('422');
    expect(line).toContain('Unprocessable entity');
  });

  it('does not include a user segment when the request is unauthenticated', () => {
    const host = makeHost({ method: 'GET', url: '/v1/public/programs' });

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [line] = warnSpy.mock.calls[0];
    expect(line).not.toContain('user=');
  });

  // Note: a 500 HttpException only hits `logger.error` when isProd is true
  // (pre-existing behavior, unrelated to this fix and left unchanged here).
  // The unconditional 500 path — any non-HttpException, non-DomainException
  // throw — is covered below and is what real unhandled errors look like.
  it('does not warn for a 500 HttpException', () => {
    const host = makeHost({ method: 'GET', url: '/v1/programs/1' });

    filter.catch(
      new HttpException('Boom', HttpStatus.INTERNAL_SERVER_ERROR),
      host,
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs at error level (not warn) for an unrecognized thrown error', () => {
    const host = makeHost({ method: 'GET', url: '/v1/programs/1' });

    filter.catch(new Error('Unexpected failure'), host);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [line] = errorSpy.mock.calls[0];
    expect(line).toContain('500');
    expect(line).toContain('Unexpected failure');
  });
});
