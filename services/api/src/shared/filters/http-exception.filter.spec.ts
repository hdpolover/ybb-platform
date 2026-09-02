import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  it('forwards an errors[] array from the exception body intact (field-level validation detail)', () => {
    const host = makeHost({ method: 'PUT', url: '/v1/applications/app-1/review' });

    filter.catch(
      new BadRequestException({
        message: 'Review items are invalid.',
        errors: [{ path: 'items[0].score', message: 'Score must be between 0 and 100 for this criterion.' }],
      }),
      host,
    );

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errors: [{ path: 'items[0].score', message: 'Score must be between 0 and 100 for this criterion.' }],
      }),
    );
  });

  it('does not forward a non-array errors value, and does not break the response', () => {
    const host = makeHost({ method: 'PUT', url: '/v1/applications/app-1/review' });

    filter.catch(
      new BadRequestException({ message: 'Bad input.', errors: 'not-an-array' }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errors');
    expect(body).toEqual(expect.objectContaining({ statusCode: 400, message: 'Bad input.' }));
  });

  it('does not forward an object (non-array) errors value either', () => {
    const host = makeHost({ method: 'PUT', url: '/v1/applications/app-1/review' });

    filter.catch(
      new BadRequestException({ message: 'Bad input.', errors: { path: 'items', message: 'oops' } }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errors');
    expect(body).toEqual(expect.objectContaining({ statusCode: 400, message: 'Bad input.' }));
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

  it('forwards `errorCode` when only `errorCode` is present on the exception body', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ errorCode: 'confirm_required', message: 'Confirmation required.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({ statusCode: 400, errorCode: 'confirm_required' }),
    );
  });

  it('forwards `code` as `errorCode` when only `code` is present on the exception body (the fix)', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ code: 'empty_replace_source', message: 'Nothing to copy.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({ statusCode: 400, errorCode: 'empty_replace_source' }),
    );
  });

  it('prefers `errorCode` over `code` when both are present with differing values', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ errorCode: 'errorCode-value', code: 'code-value', message: 'Conflict.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({ statusCode: 400, errorCode: 'errorCode-value' }),
    );
  });

  it('ignores a non-string `code` value and does not emit `errorCode` or crash', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ code: 42, message: 'Bad shape.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errorCode');
    expect(body).toEqual(expect.objectContaining({ statusCode: 400, message: 'Bad shape.' }));
  });

  it('ignores a non-string `code` object value and does not emit `errorCode` or crash', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ code: { nested: true }, message: 'Bad shape.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errorCode');
    expect(body).toEqual(expect.objectContaining({ statusCode: 400, message: 'Bad shape.' }));
  });

  it('emits no `errorCode` key at all when neither `errorCode` nor `code` is present', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/copy' });

    filter.catch(
      new BadRequestException({ message: 'Plain failure, no code.' }),
      host,
    );

    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errorCode');
    expect(body).toEqual(expect.objectContaining({ statusCode: 400, message: 'Plain failure, no code.' }));
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

  // --- Prisma error mapping (M87) -------------------------------------------
  // Constructed with the same shapes verified against a real Postgres in
  // upsert-scoring-rubric.handler.spec.ts: adapter-pg populates
  // meta.driverAdapterError.cause, leaves meta.target undefined, and always
  // carries the raw text in the message.
  const makeKnown = (
    code: string,
    message: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError =>
    new Prisma.PrismaClientKnownRequestError(message, {
      code,
      clientVersion: 'test',
      ...(meta ? { meta } : {}),
    });

  const PRISMA_RAW = 'Invalid `prisma.user.create()` invocation:\n\nUnique constraint failed';

  it('maps a P2002 with the adapter-pg constraint.fields shape to 409 naming the column', () => {
    const host = makeHost({ method: 'POST', url: '/v1/auth/register' });

    filter.catch(
      makeKnown('P2002', PRISMA_RAW, {
        driverAdapterError: { cause: { constraint: { fields: ['email'] } } },
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(409);
    const [body] = jsonMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 409,
        message: 'A record with this email already exists.',
        errorCode: 'DUPLICATE_RECORD',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('prisma.user.create');
  });

  it('maps a P2002 with the meta.target array shape to 409', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs/1/rubric' });

    filter.catch(
      makeKnown('P2002', 'Unique constraint failed', {
        target: ['program_id', 'stage'],
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: 'A record with these values already exists (program_id, stage).',
        errorCode: 'DUPLICATE_RECORD',
      }),
    );
  });

  it('falls back to a field-less 409 message when a P2002 carries no extractable fields', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs' });

    filter.catch(makeKnown('P2002', 'Unique constraint failed', {}), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: 'A record with these values already exists.',
        errorCode: 'DUPLICATE_RECORD',
      }),
    );
  });

  it('maps P2025 to 404 RECORD_NOT_FOUND without echoing Prisma meta', () => {
    const host = makeHost({ method: 'PATCH', url: '/v1/programs/1' });

    filter.catch(
      makeKnown('P2025', 'An operation failed because it depends on one or more records that were required but not found.', {
        modelName: 'Program',
        operation: 'an update',
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    const [body] = jsonMock.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        message: 'The requested record no longer exists.',
        errorCode: 'RECORD_NOT_FOUND',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('an update');
  });

  it('maps P2000 to 400 VALUE_TOO_LONG, naming the column when the driver supplies it', () => {
    const host = makeHost({ method: 'POST', url: '/v1/participants' });

    filter.catch(
      makeKnown('P2000', 'The provided value for the column is too long', {
        driverAdapterError: {
          cause: {
            originalMessage: 'value too long for type character varying(50)',
            column: 'institution',
          },
        },
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: 'The value provided for institution is too long.',
        errorCode: 'VALUE_TOO_LONG',
      }),
    );
  });

  it('maps P2000 to a column-less 400 when Postgres supplies no column (the real 22001 case)', () => {
    const host = makeHost({ method: 'POST', url: '/v1/participants' });

    filter.catch(
      makeKnown('P2000', 'The provided value for the column is too long', {
        driverAdapterError: {
          cause: { originalMessage: 'value too long for type character varying(50)' },
        },
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: 'One of the provided values is too long.',
        errorCode: 'VALUE_TOO_LONG',
      }),
    );
  });

  it('maps P2024 to 503 and logs via error (with stack), not warn', () => {
    const host = makeHost({ method: 'GET', url: '/v1/programs' });

    filter.catch(makeKnown('P2024', 'Timed out fetching a new connection from the pool'), host);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [line, stack] = errorSpy.mock.calls[0];
    expect(line).toContain('503');
    expect(line).toContain('P2024');
    expect(stack).toBeDefined();
    expect(jsonMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ statusCode: 503, errorCode: 'DATABASE_UNAVAILABLE' }),
    );
  });

  it('leaves an unmapped Prisma code (P2016) as the existing 500 behavior', () => {
    const host = makeHost({ method: 'GET', url: '/v1/programs' });

    filter.catch(makeKnown('P2016', 'Query interpretation error'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [body] = jsonMock.mock.calls[0];
    expect(body).not.toHaveProperty('errorCode');
  });

  it('leaves PrismaClientValidationError (a developer bug) as a 500', () => {
    const host = makeHost({ method: 'POST', url: '/v1/programs' });

    filter.catch(
      new Prisma.PrismaClientValidationError('Argument `where` is missing', {
        clientVersion: 'test',
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('puts the Prisma code in the 4xx warn line but never in the JSON body', () => {
    const host = makeHost({
      method: 'POST',
      url: '/v1/auth/register',
      user: { userId: 'user-9' },
    });

    filter.catch(
      makeKnown('P2002', PRISMA_RAW, {
        driverAdapterError: { cause: { constraint: { fields: ['email'] } } },
      }),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    const [line] = warnSpy.mock.calls[0];
    expect(line).toContain('P2002');
    expect(line).toContain('prisma.user.create');
    expect(line).toContain('user-9');

    const [body] = jsonMock.mock.calls[0];
    expect(JSON.stringify(body)).not.toContain('P2002');
  });
});
