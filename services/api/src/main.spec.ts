// src/main.spec.ts
//
// Covers M171: the HTTP server must come up even when RabbitMQ is completely
// unreachable at boot, RabbitMQ startup must retry with backoff in the
// background instead of crashing the process, and ensureRetryTopology must
// tolerate a 406 PRECONDITION_FAILED (e.g. a changed RABBITMQ_RETRY_DELAY_MS
// against an already-declared `.retry` queue) instead of killing boot.
//
// main.ts only runs `bootstrap()` automatically when it is the Node entry
// point (`require.main === module`), which is false when it is imported here
// as a module under Jest — so importing it in this file has no side effects
// beyond evaluating its top-level declarations.

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
    createMicroservice: jest.fn(),
  },
}));

// Swagger setup expects a real INestApplication (DocumentBuilder/SwaggerModule
// internals); keep it off so the mock `app` object below is sufficient.
jest.mock('./config/swagger.config', () => ({
  isSwaggerEnabled: () => false,
  setupSwagger: jest.fn(),
}));

// The consumer modules are only ever passed by reference to the (mocked)
// NestFactory.createMicroservice — never instantiated by Nest DI in these
// tests — so dummy classes are enough and keep the five real module graphs
// out of this spec.
jest.mock('./bootstrap/audit-consumer.module', () => ({ AuditConsumerModule: class AuditConsumerModule {} }));
jest.mock('./bootstrap/reporting-consumer.module', () => ({ ReportingConsumerModule: class ReportingConsumerModule {} }));
jest.mock('./bootstrap/payment-events-consumer.module', () => ({
  PaymentEventsConsumerModule: class PaymentEventsConsumerModule {},
}));
jest.mock('./bootstrap/loa-events-consumer.module', () => ({ LoaEventsConsumerModule: class LoaEventsConsumerModule {} }));
jest.mock('./bootstrap/reminder-events-consumer.module', () => ({
  ReminderEventsConsumerModule: class ReminderEventsConsumerModule {},
}));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));

import * as amqp from 'amqplib';
import { NestFactory } from '@nestjs/core';
import {
  bootstrap,
  startRabbitMqConsumers,
  ensureRetryTopology,
  computeRabbitMqBackoffDelayMs,
} from './main';

const amqpConnectMock = amqp.connect as jest.Mock;
const nestFactoryCreateMock = NestFactory.create as jest.Mock;
const nestFactoryCreateMicroserviceMock = NestFactory.createMicroservice as jest.Mock;

function createMockHttpApp() {
  return {
    use: jest.fn(),
    useLogger: jest.fn(),
    useGlobalFilters: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalInterceptors: jest.fn(),
    enableVersioning: jest.fn(),
    enableCors: jest.fn(),
    getHttpAdapter: jest.fn(),
    get: jest.fn().mockReturnValue({}),
    listen: jest.fn().mockResolvedValue(undefined),
  };
}

describe('main.ts bootstrap (M171)', () => {
  const originalRabbitMqUrl = process.env.RABBITMQ_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
    nestFactoryCreateMock.mockResolvedValue(createMockHttpApp());
    nestFactoryCreateMicroserviceMock.mockResolvedValue({ listen: jest.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.RABBITMQ_URL = originalRabbitMqUrl;
  });

  it('starts the HTTP app even when the broker connect/assert path rejects', async () => {
    amqpConnectMock.mockRejectedValue(new Error('ECONNREFUSED'));
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const mockApp = createMockHttpApp();
    nestFactoryCreateMock.mockResolvedValue(mockApp);

    await bootstrap();

    expect(mockApp.listen).toHaveBeenCalledTimes(1);
    expect(mockApp.listen).toHaveBeenCalledWith(process.env.PORT || 3000);

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('does not reject the bootstrap promise when consumer startup fails', async () => {
    amqpConnectMock.mockRejectedValue(new Error('ECONNREFUSED'));
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(bootstrap()).resolves.toBeUndefined();

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('retries RabbitMQ consumer startup with growing backoff instead of giving up', async () => {
    jest.useFakeTimers();
    amqpConnectMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Fire-and-forget: startRabbitMqConsumers never resolves while amqp.connect
    // keeps rejecting, so this deliberately is not awaited.
    void startRabbitMqConsumers('amqp://guest:guest@localhost:5672', 15000);

    // Attempt 1 runs immediately (5 queues resolved in parallel via Promise.all).
    await jest.advanceTimersByTimeAsync(0);
    const callsAfterAttempt1 = amqpConnectMock.mock.calls.length;
    expect(callsAfterAttempt1).toBeGreaterThan(0);
    expect(computeRabbitMqBackoffDelayMs(1)).toBe(1000);

    // Backoff after attempt 1 is 1000ms.
    await jest.advanceTimersByTimeAsync(1000);
    const callsAfterAttempt2 = amqpConnectMock.mock.calls.length;
    expect(callsAfterAttempt2).toBeGreaterThan(callsAfterAttempt1);
    expect(computeRabbitMqBackoffDelayMs(2)).toBe(2000);

    // Backoff after attempt 2 is 2000ms.
    await jest.advanceTimersByTimeAsync(2000);
    const callsAfterAttempt3 = amqpConnectMock.mock.calls.length;
    expect(callsAfterAttempt3).toBeGreaterThan(callsAfterAttempt2);
    expect(computeRabbitMqBackoffDelayMs(3)).toBe(4000);

    // The logged delay grows with each failed attempt, and never exceeds the cap.
    const loggedDelays = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('retrying in'))
      .map((message) => Number(message.match(/retrying in (\d+)ms/)?.[1]));
    expect(loggedDelays).toEqual(expect.arrayContaining([1000, 2000, 4000]));

    errorSpy.mockRestore();
  });

  it('caps backoff delay at RMQ_STARTUP_MAX_DELAY_MS and never gives up retrying', () => {
    expect(computeRabbitMqBackoffDelayMs(1)).toBe(1000);
    expect(computeRabbitMqBackoffDelayMs(2)).toBe(2000);
    expect(computeRabbitMqBackoffDelayMs(10)).toBe(60000);
    expect(computeRabbitMqBackoffDelayMs(100)).toBe(60000);
  });
});

describe('ensureRetryTopology (M171 — 406 PRECONDITION_FAILED tolerance)', () => {
  function createMockChannel() {
    return {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn(),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  function createMockConnection(channel: ReturnType<typeof createMockChannel>) {
    return {
      on: jest.fn(),
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not throw when the retry queue assert hits 406 PRECONDITION_FAILED, and still closes the channel/connection', async () => {
    const preconditionError = Object.assign(
      new Error('Operation failed: QueueDeclare; 406 (PRECONDITION-FAILED) - inequivalent arg x-message-ttl'),
      { code: 406 },
    );
    const channel = createMockChannel();
    channel.assertQueue
      .mockResolvedValueOnce(undefined) // primary queue assert succeeds
      .mockRejectedValueOnce(preconditionError); // `${queue}.retry` assert fails

    const connection = createMockConnection(channel);
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      ensureRetryTopology('amqp://guest:guest@localhost:5672', 'audit_log_queue', {
        retryDelayMs: 15000,
        primaryQueueOptions: {},
        binding: { exchange: 'ybb.events', exchangeType: 'topic', routingKey: '#' },
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PRECONDITION_FAILED'));
    // dlq assert (the 3rd assertQueue call) and bindQueue are skipped once the
    // precondition failure is caught.
    expect(channel.assertQueue).toHaveBeenCalledTimes(2);
    expect(channel.bindQueue).not.toHaveBeenCalled();
    // Cleanup still runs (finally block).
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('still throws for a non-406 topology failure', async () => {
    const otherError = new Error('channel closed unexpectedly');
    const channel = createMockChannel();
    channel.assertQueue.mockRejectedValueOnce(otherError);
    const connection = createMockConnection(channel);
    (amqp.connect as jest.Mock).mockResolvedValue(connection);

    await expect(
      ensureRetryTopology('amqp://guest:guest@localhost:5672', 'reporting_queue', {
        retryDelayMs: 15000,
        primaryQueueOptions: {},
      }),
    ).rejects.toThrow(/RabbitMQ topology assertion failed for queue "reporting_queue"/);

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});
