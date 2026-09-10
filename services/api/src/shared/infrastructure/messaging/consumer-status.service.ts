// src/shared/infrastructure/messaging/consumer-status.service.ts
import { Injectable } from '@nestjs/common';
import { API_CONSUMER_QUEUES, QUEUE_POLL_INTERVAL_MS } from '../../constants/rabbitmq-queues';

export type ConsumerState = 'connecting' | 'connected' | 'disconnected';

// N-2026-09-10-G: consumerBootstrap (above) only ever reflects the one-time
// RMQ connect at process start. This is the runtime half, fed by
// QueueMonitoringService's existing 15s consumerCount poll instead of a new
// connection — see recordQueueObservation.
//
// 'active'   — every API consumer queue has a fresh, non-zero consumerCount.
// 'inactive' — at least one API consumer queue has a fresh reading of
//              EXACTLY zero. Zero is unambiguous: amqplib's checkQueue consumerCount
//              is the broker's own count of consuming channels on that queue,
//              cluster-wide across every API replica, so zero means nobody
//              anywhere is consuming it. A non-zero reading is the opposite:
//              it proves at least one replica is alive, never that THIS
//              replica is — see recordQueueObservation for why the field
//              below is named to not claim otherwise.
// 'unknown'  — some queue has no fresh observation at all (poll never
//              reported it, or the reading is older than the staleness
//              window). This is the default whenever there isn't enough
//              signal to say 'active' or 'inactive' with confidence — a
//              stale reading must not get pinned as a stand-in for a live
//              one, and the monitoring connection being down (so the poll
//              stops reporting in) surfaces here rather than as a false
//              'active' or a flap to 'inactive'.
export type ConsumerActivity = 'active' | 'inactive' | 'unknown';

// A reading is trusted for this many poll intervals before it is treated as
// no-observation-at-all. One missed tick (a transient broker hiccup) should
// not flip the whole indicator to 'unknown'; a monitoring connection that's
// actually down for a while must.
const STALE_OBSERVATION_POLLS = 3;

interface QueueObservation {
  consumerCount: number;
  observedAtMs: number;
}

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

  // Keyed by queue name; only ever holds the five API_CONSUMER_QUEUES (see
  // recordQueueObservation's guard) even though QueueMonitoringService polls
  // more queues than that (notification_queue belongs to another service).
  private readonly queueObservations = new Map<string, QueueObservation>();

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

  // Called by QueueMonitoringService after each successful passive-declare
  // for a queue (see queue-monitoring.service.ts's checkQueueDepths). Only
  // API_CONSUMER_QUEUES are recorded — queue-monitoring also polls
  // notification_queue and every queue's .retry/.dlq siblings, none of which
  // this API's own consumers own, so they carry no signal about whether
  // THIS process's consumers are alive and are silently ignored here.
  recordQueueObservation(queue: string, consumerCount: number): void {
    if (!API_CONSUMER_QUEUES.includes(queue)) {
      return;
    }
    this.queueObservations.set(queue, { consumerCount, observedAtMs: Date.now() });
  }

  // Derives the runtime indicator HealthController exposes as
  // `consumerActivity` (see the type doc above for what each value means and
  // why). Zero-consumer observations take priority over merely-stale ones:
  // "definitely nobody is consuming this queue" is a stronger, more useful
  // signal than "we don't currently know," so one fresh zero reading reports
  // 'inactive' even if another queue's reading has gone stale in the same
  // tick.
  getConsumerActivity(): ConsumerActivity {
    const staleAfterMs = STALE_OBSERVATION_POLLS * QUEUE_POLL_INTERVAL_MS;
    const now = Date.now();

    let anyZero = false;
    let anyStaleOrMissing = false;

    for (const queue of API_CONSUMER_QUEUES) {
      const observation = this.queueObservations.get(queue);
      if (!observation || now - observation.observedAtMs > staleAfterMs) {
        anyStaleOrMissing = true;
        continue;
      }
      if (observation.consumerCount === 0) {
        anyZero = true;
      }
    }

    if (anyZero) return 'inactive';
    if (anyStaleOrMissing) return 'unknown';
    return 'active';
  }
}
