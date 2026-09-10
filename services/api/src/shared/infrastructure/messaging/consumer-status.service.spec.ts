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
