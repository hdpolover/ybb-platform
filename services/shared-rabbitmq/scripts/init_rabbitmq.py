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
QUEUES = [
    {
        'name': 'notification_queue',
        'bindings': ['user.#', 'payment.#', 'system.announcement']
    },
    {
        'name': 'reporting_queue',
        'bindings': ['#']
    },
    {
        'name': 'audit_log_queue',
        'bindings': ['#']
    }
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

def main():
    connection = wait_for_rabbitmq()
    channel = connection.channel()

    log(f"Declaring Topic Exchange: {EXCHANGE_NAME}")
    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)

    for q in QUEUES:
        q_name = q['name']
        log(f"Declaring Queue: {q_name}")
        channel.queue_declare(queue=q_name, durable=True)
        
        for binding_key in q['bindings']:
            log(f"  -> Binding {q_name} to {EXCHANGE_NAME} with key: {binding_key}")
            channel.queue_bind(exchange=EXCHANGE_NAME, queue=q_name, routing_key=binding_key)

    log("✅ RabbitMQ Topology Initialized Successfully!")
    connection.close()

if __name__ == '__main__':
    main()
