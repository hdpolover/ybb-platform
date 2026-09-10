// src/shared/infrastructure/messaging/consumer-status.service.ts
import { Injectable } from '@nestjs/common';
import { API_CONSUMER_QUEUES } from '../../constants/rabbitmq-queues';

export type ConsumerState = 'connecting' | 'connected' | 'disconnected';

// Shape read by HealthController. Deliberately has no error message field —
// /v1/health is public and unauthenticated (no global APP_GUARD covers it),
// so a broker error string (which can carry connection details or a topology
// mismatch) must never reach an anonymous caller through it. Use
// getLastErrorMessage() below for that, and only from server-side logging.
export interface ConsumerStatusSnapshot {
  state: ConsumerState;
  attemptCount: number;
  connectedAt: Date | null;
  lastFailureAt: Date | null;
  queues: readonly string[];
}

// Tracks the BOOTSTRAP of the five RMQ consumer apps started by
// startRabbitMqConsumers in main.ts, so the HTTP process (which comes up
// independently — see M171 in main.ts) stops staying silent when a broker
// outage at boot leaves every consumer down.
//
// Scope, stated plainly because the distinction is the whole point:
// startRabbitMqConsumers RETURNS once it has connected, and nothing calls in
// here again. 'connected' therefore means "the bootstrap completed", NOT
// "consumers are currently consuming" — a broker that dies an hour after boot
// leaves this reading 'connected' forever. HealthController exposes it as
// `consumerBootstrap`, not `consumers`, for exactly that reason: an endpoint
// must not assert a fact it never rechecks (see /health/db's old hardcoded
// `database: 'connected'`). Closing the runtime half needs the per-queue
// consumerCount QueueMonitoringService already polls every 15s.
//
// Must be safe to construct and read before startRabbitMqConsumers ever
// calls it — the HTTP app can serve /health before the background RMQ
// bootstrap has attempted a connection at all, hence the 'connecting'
// initial state rather than 'disconnected'.
@Injectable()
export class ConsumerStatusService {
  private state: ConsumerState = 'connecting';
  private attemptCount = 0;
  private connectedAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastErrorMessage: string | null = null;

  recordAttempt(): void {
    this.attemptCount += 1;
  }

  recordConnected(): void {
    this.state = 'connected';
    this.connectedAt = new Date();
  }

  recordFailure(error: Error): void {
    this.state = 'disconnected';
    this.lastFailureAt = new Date();
    this.lastErrorMessage = error.message;
  }

  // Read by HealthController — state/attemptCount/timestamps/queues only.
  getSnapshot(): ConsumerStatusSnapshot {
    return {
      state: this.state,
      attemptCount: this.attemptCount,
      connectedAt: this.connectedAt,
      lastFailureAt: this.lastFailureAt,
      queues: API_CONSUMER_QUEUES,
    };
  }

  // Internal/diagnostic only. NOT called by HealthController — keep it that
  // way, per the note on ConsumerStatusSnapshot above.
  getLastErrorMessage(): string | null {
    return this.lastErrorMessage;
  }
}
