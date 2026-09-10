// src/shared/constants/rabbitmq-queues.ts
//
// Single source of truth for the RabbitMQ queue names this service cares
// about. main.ts's consumer bootstrap (connectRabbitMqConsumers) and
// queue-monitoring.service.ts previously each hardcoded their own queue
// lists, and drifted: queue-monitoring covered only 2 of the 6 queues it
// should have (audit_log_queue, reporting_queue, api-service-loa-events and
// api-service-reminder-events were invisible to /metrics). Both now import
// from here instead of repeating string literals.

// The five queues this API's own RMQ consumer apps subscribe to (see
// connectRabbitMqConsumers in main.ts). Each has a `.retry` and `.dlq`
// sibling asserted by ensureRetryTopology.
export const AUDIT_LOG_QUEUE = 'audit_log_queue';
export const REPORTING_QUEUE = 'reporting_queue';
export const PAYMENT_EVENTS_QUEUE = 'api-service-payment-events';
export const LOA_EVENTS_QUEUE = 'api-service-loa-events';
export const REMINDER_EVENTS_QUEUE = 'api-service-reminder-events';

export const API_CONSUMER_QUEUES: readonly string[] = [
  AUDIT_LOG_QUEUE,
  REPORTING_QUEUE,
  PAYMENT_EVENTS_QUEUE,
  LOA_EVENTS_QUEUE,
  REMINDER_EVENTS_QUEUE,
];

// Owned by services/notification, not this API. Monitored from here anyway
// because this is the one process with an HTTP surface for /metrics to
// scrape — see monitoring.module.ts's comment on why consumer bootstraps
// don't get this.
export const NOTIFICATION_QUEUE = 'notification_queue';

// A queue name plus the `.retry`/`.dlq` siblings ensureRetryTopology always
// asserts alongside it.
export function withRetrySiblings(queueName: string): readonly [string, string, string] {
  return [queueName, `${queueName}.retry`, `${queueName}.dlq`];
}

// Every queue worth polling for depth/consumer-count: the five API consumer
// queues plus notification_queue, each expanded to its primary/retry/dlq
// trio.
export const MONITORED_QUEUES: readonly string[] = [...API_CONSUMER_QUEUES, NOTIFICATION_QUEUE].flatMap(
  withRetrySiblings,
);

// How often QueueMonitoringService polls broker consumer counts. Shared with
// ConsumerStatusService, which age-caps those observations as a multiple of
// this interval (see STALE_OBSERVATION_POLLS there) instead of a hardcoded
// duration that would silently drift out of sync with the poll itself.
export const QUEUE_POLL_INTERVAL_MS = 15_000;
