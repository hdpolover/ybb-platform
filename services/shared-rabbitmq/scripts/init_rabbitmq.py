import pika
import os
import time
import sys
import datetime

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'guest')

EXCHANGE_NAME = 'ybb.events'

# Secondary topic exchange owned by the Go payment service. Configured via
# RABBITMQ_EXCHANGE in services/payment/internal/infrastructure/config/config.go
# (default: 'payment-events'). Declared here so the API's consumer queue can
# bind on first start and not silently drop payment.* events.
PAYMENT_EXCHANGE_NAME = 'payment-events'

# Queue declarations: name, optional args, optional bindings.
# Retry queues use dead-letter exchange (DLX) to implement delayed retry:
#   primary → .retry (via DLX on nack) → primary (after TTL expires)
#              → .dlq (via DLX after max retries)
#
# Retry delay defaults match the consuming service defaults. Override via
# NOTIFICATION_QUEUE_RETRY_DELAY_MS / API_PAYMENT_QUEUE_RETRY_DELAY_MS env
# vars on the respective services. The TTL here only affects queues that
# don't yet exist — existing queues keep their declared TTL.
QUEUES = [
    # notification_queue family
    {
        'name': 'notification_queue',
        'args': {
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'notification_queue.retry',
        },
        'exchange': EXCHANGE_NAME,
        'bindings': ['user.#', 'payment.#', 'system.announcement'],
    },
    # Same queue, additional bindings from payment exchange
    {
        'name': 'notification_queue',
        'exchange': PAYMENT_EXCHANGE_NAME,
        'bindings': ['payment.#'],
    },
    {
        'name': 'notification_queue.retry',
        'args': {
            'x-message-ttl': 15000,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'notification_queue',
        },
    },
    {
        'name': 'notification_queue.dlq',
    },
    # reporting and audit queues (no retry topology — these are append-only)
    {
        'name': 'reporting_queue',
        'exchange': EXCHANGE_NAME,
        'bindings': ['#'],
    },
    {
        'name': 'audit_log_queue',
        'exchange': EXCHANGE_NAME,
        'bindings': ['#'],
    },
    # api-service-payment-events family
    {
        'name': 'api-service-payment-events',
        'args': {
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'api-service-payment-events.retry',
        },
        'exchange': PAYMENT_EXCHANGE_NAME,
        'bindings': ['payment.#'],
    },
    {
        'name': 'api-service-payment-events.retry',
        'args': {
            'x-message-ttl': 30000,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'api-service-payment-events',
        },
    },
    {
        'name': 'api-service-payment-events.dlq',
    },
]

def log(message):
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    print(f"[{timestamp}] [InitScript] {message}", flush=True)

def wait_for_rabbitmq():
    log(f"Connecting to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}...")
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        retry_delay=5
    )

    attempts = 0
    while attempts < 30:
        try:
            connection = pika.BlockingConnection(parameters)
            log("Connected to RabbitMQ successfully!")
            return connection
        except pika.exceptions.AMQPConnectionError as e:
            log(f"Connection failed, retrying in 2s... ({e})")
            time.sleep(2)
            attempts += 1

    log("Could not connect to RabbitMQ after multiple attempts.")
    sys.exit(1)

def ensure_queue(connection: pika.BlockingConnection, q_name: str, args: dict = None) -> pika.channel.Channel:
    """Declare queue if absent; skip if it already exists (possibly with different args).

    Args are only applied on first creation. If the queue already exists with
    different args (406 PRECONDITION_FAILED), the existing queue is left unchanged.
    Use NOTIFICATION_QUEUE_CLEANUP_ON_DEPLOY=true on the notification service to
    force recreation with the correct DLX topology.
    """
    ch = connection.channel()
    try:
        # passive=True checks existence without modifying args
        ch.queue_declare(queue=q_name, durable=True, passive=True)
        log(f"Queue '{q_name}' already exists — skipping declare")
        return ch
    except pika.exceptions.ChannelClosedByBroker as e:
        new_ch = connection.channel()
        if e.reply_code == 404:
            # Queue absent — create it with the specified args
            declare_kwargs = {'queue': q_name, 'durable': True}
            if args:
                declare_kwargs['arguments'] = args
            new_ch.queue_declare(**declare_kwargs)
            log(f"Queue '{q_name}' created" + (" with DLX args" if args else ""))
        # 406 PRECONDITION_FAILED = exists with different args (e.g. legacy queue
        # without DLX). Queue is functional; skip re-declare and proceed to bindings.
        elif e.reply_code != 406:
            raise
        return new_ch


def main():
    connection = wait_for_rabbitmq()
    channel = connection.channel()

    for ex in {EXCHANGE_NAME, PAYMENT_EXCHANGE_NAME}:
        log(f"Declaring Topic Exchange: {ex}")
        channel.exchange_declare(exchange=ex, exchange_type='topic', durable=True)

    declared = set()
    for q in QUEUES:
        q_name = q['name']
        ex_name = q.get('exchange')
        q_args = q.get('args')

        if q_name not in declared:
            log(f"Declaring Queue: {q_name}")
            channel = ensure_queue(connection, q_name, args=q_args)
            declared.add(q_name)

        for binding_key in q.get('bindings', []):
            if ex_name:
                log(f"  -> Binding {q_name} to {ex_name} with key: {binding_key}")
                channel.queue_bind(exchange=ex_name, queue=q_name, routing_key=binding_key)

    log("✅ RabbitMQ Topology Initialized Successfully!")
    connection.close()

if __name__ == '__main__':
    main()
