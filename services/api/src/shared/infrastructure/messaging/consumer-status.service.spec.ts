// src/shared/infrastructure/messaging/consumer-status.service.spec.ts
import { ConsumerStatusService } from './consumer-status.service';

describe('ConsumerStatusService', () => {
  let service: ConsumerStatusService;

  beforeEach(() => {
    service = new ConsumerStatusService();
  });

  it('starts in the connecting state, safe to read before anything reports to it', () => {
    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('connecting');
    expect(snapshot.attemptCount).toBe(0);
    expect(snapshot.connectedAt).toBeNull();
    expect(snapshot.lastFailureAt).toBeNull();
    expect(service.getLastErrorMessage()).toBeNull();
  });

  it('walks connecting -> connected -> disconnected -> connected, tracking attempts and timestamps', () => {
    service.recordAttempt();
    expect(service.getSnapshot().attemptCount).toBe(1);
    expect(service.getSnapshot().state).toBe('connecting');

    service.recordConnected();
    const afterFirstConnect = service.getSnapshot();
    expect(afterFirstConnect.state).toBe('connected');
    expect(afterFirstConnect.connectedAt).toBeInstanceOf(Date);

    service.recordAttempt();
    service.recordFailure(new Error('ECONNREFUSED'));
    const afterFailure = service.getSnapshot();
    expect(afterFailure.state).toBe('disconnected');
    expect(afterFailure.attemptCount).toBe(2);
    expect(afterFailure.lastFailureAt).toBeInstanceOf(Date);
    // The message is tracked internally but never surfaces on the public
    // snapshot the controller reads.
    expect(service.getLastErrorMessage()).toBe('ECONNREFUSED');
    expect((afterFailure as unknown as Record<string, unknown>).lastErrorMessage).toBeUndefined();

    service.recordAttempt();
    service.recordConnected();
    const afterReconnect = service.getSnapshot();
    expect(afterReconnect.state).toBe('connected');
    expect(afterReconnect.attemptCount).toBe(3);
    // connectedAt is refreshed on reconnect; lastFailureAt is left as history.
    expect(afterReconnect.connectedAt).toBeInstanceOf(Date);
    expect(afterReconnect.lastFailureAt).toBeInstanceOf(Date);
  });

  it('exposes the five API consumer queue names on the snapshot', () => {
    const { queues } = service.getSnapshot();
    expect(queues).toEqual([
      'audit_log_queue',
      'reporting_queue',
      'api-service-payment-events',
      'api-service-loa-events',
      'api-service-reminder-events',
    ]);
  });
});

describe('ConsumerStatusService — getConsumerActivity (N-2026-09-10-G)', () => {
  let service: ConsumerStatusService;
  const ALL_FIVE_QUEUES = [
    'audit_log_queue',
    'reporting_queue',
    'api-service-payment-events',
    'api-service-loa-events',
    'api-service-reminder-events',
  ];

  beforeEach(() => {
    service = new ConsumerStatusService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports unknown when no queue has ever been observed (e.g. the monitoring poll has never connected)', () => {
    expect(service.getConsumerActivity()).toBe('unknown');
  });

  it('reports active once every API consumer queue has a fresh, non-zero observation', () => {
    for (const queue of ALL_FIVE_QUEUES) {
      service.recordQueueObservation(queue, 2);
    }

    expect(service.getConsumerActivity()).toBe('active');
  });

  it('reports inactive when any API consumer queue has a fresh reading of exactly zero', () => {
    for (const queue of ALL_FIVE_QUEUES) {
      service.recordQueueObservation(queue, 2);
    }
    service.recordQueueObservation('api-service-payment-events', 0);

    expect(service.getConsumerActivity()).toBe('inactive');
  });

  it('ignores observations for queues outside the five API consumer queues', () => {
    service.recordQueueObservation('notification_queue', 0);

    // No API consumer queue was ever recorded, so this must not read as
    // 'active' just because the one queue it did see was non-relevant, nor
    // as 'inactive' from a queue that was never ours to begin with.
    expect(service.getConsumerActivity()).toBe('unknown');
  });

  it('reports unknown once the newest observation is older than the staleness window, without flapping to inactive', () => {
    for (const queue of ALL_FIVE_QUEUES) {
      service.recordQueueObservation(queue, 2);
    }
    expect(service.getConsumerActivity()).toBe('active');

    // Poll interval is 15s and the staleness window is a small multiple of
    // it; push every observation well past that without any new zero reading.
    const longAgo = Date.now() - 10 * 60 * 1000;
    const observations = (service as unknown as { queueObservations: Map<string, { consumerCount: number; observedAtMs: number }> })
      .queueObservations;
    for (const queue of ALL_FIVE_QUEUES) {
      const existing = observations.get(queue)!;
      observations.set(queue, { ...existing, observedAtMs: longAgo });
    }

    expect(service.getConsumerActivity()).toBe('unknown');
  });

  it('does not let one missed poll tick alone flip active to unknown', () => {
    for (const queue of ALL_FIVE_QUEUES) {
      service.recordQueueObservation(queue, 2);
    }

    // A single 15s tick late is still inside the staleness window (a small
    // multiple of the poll interval), so a transient hiccup should not flap
    // the indicator.
    const observations = (service as unknown as { queueObservations: Map<string, { consumerCount: number; observedAtMs: number }> })
      .queueObservations;
    const oneTickLate = Date.now() - 16 * 1000;
    observations.set('reporting_queue', { ...observations.get('reporting_queue')!, observedAtMs: oneTickLate });

    expect(service.getConsumerActivity()).toBe('active');
  });
});
