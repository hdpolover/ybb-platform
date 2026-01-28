import aio_pika
import logging
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

class RabbitMQService:
    def __init__(self, amqp_url: str, exchange_name: str = "ybb.events"):
        self.amqp_url = amqp_url
        self.exchange_name = exchange_name
        self.connection: Optional[aio_pika.Connection] = None
        self.channel: Optional[aio_pika.Channel] = None
        self.exchange: Optional[aio_pika.Exchange] = None

    async def connect(self):
        """Connect to RabbitMQ."""
        try:
            self.connection = await aio_pika.connect_robust(self.amqp_url)
            self.channel = await self.connection.channel()
            # Declare exchange (Topic type for flexibility)
            self.exchange = await self.channel.declare_exchange(
                self.exchange_name, 
                aio_pika.ExchangeType.TOPIC, 
                durable=True
            )
            logging.info(f"Connected to RabbitMQ at {self.exchange_name}")
        except Exception as e:
            logging.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    async def close(self):
        """Close connection."""
        if self.connection:
            await self.connection.close()

    async def publish_event(self, routing_key: str, data: Dict[str, Any]):
        """Publish an event to the exchange."""
        if not self.exchange:
            logging.warning("RabbitMQ exchange not initialized. Attempting to connect...")
            await self.connect()

        message_body = json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            "event": routing_key,
            "data": data,
            "service": "file-service"
        }).encode()

        message = aio_pika.Message(
            message_body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            content_type="application/json"
        )

        try:
            await self.exchange.publish(message, routing_key=routing_key)
            logging.info(f"Published event: {routing_key}")
        except Exception as e:
            logging.error(f"Failed to publish event {routing_key}: {e}")
            # Try reconnecting once
            try:
                await self.connect()
                await self.exchange.publish(message, routing_key=routing_key)
            except Exception as retry_e:
                logging.error(f"Retry failed for {routing_key}: {retry_e}")

