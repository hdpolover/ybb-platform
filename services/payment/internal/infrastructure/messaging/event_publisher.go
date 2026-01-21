package messaging

import (
	"context"
	"fmt"
	"log"

	amqp "github.com/rabbitmq/amqp091-go" // Driver RabbitMQ
	"github.com/ybb-platform/payment/internal/domain/events"
)

// EventPublisher defines the interface for publishing events
type EventPublisher interface {
	Publish(ctx context.Context, event *events.PaymentEvent) error
	Close() error
}

// RabbitMQPublisher implements EventPublisher using RabbitMQ
type RabbitMQPublisher struct {
	connection *amqp.Connection
	channel    *amqp.Channel
	exchange   string
}

// NewRabbitMQPublisher creates a new RabbitMQ event publisher
func NewRabbitMQPublisher(rabbitMQURL, exchange string) (*RabbitMQPublisher, error) {
	// 1. Connect to RabbitMQ
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	// 2. Open Channel
	ch, err := conn.Channel()
	if err != nil {
		conn.Close() // Close connection if channel fails
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// 3. Declare Exchange (Topic Type)
	// Exchange adalah "Kotak Surat" di RabbitMQ
	err = ch.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable (tahan banting kalau server restart)
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	return &RabbitMQPublisher{
		connection: conn,
		channel:    ch,
		exchange:   exchange,
	}, nil
}

// Publish publishes an event to RabbitMQ
func (p *RabbitMQPublisher) Publish(ctx context.Context, event *events.PaymentEvent) error {
	// 1. Convert Event to JSON bytes
	body, err := event.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// 2. Determine Routing Key (Topik spesifik)
	// Contoh: "payment.succeeded" atau "payment.failed"
	routingKey := string(event.Type)

	log.Printf("[RabbitMQ] Publishing event to exchange '%s' with key '%s'", p.exchange, routingKey)

	// 3. Publish to RabbitMQ
	err = p.channel.PublishWithContext(
		ctx,
		p.exchange,
		routingKey,
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent, // Pesan disimpan ke disk (aman)
			Timestamp:    event.Timestamp,
			MessageId:    event.ID,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}

// Close closes the RabbitMQ connection
func (p *RabbitMQPublisher) Close() error {
	if p.channel != nil {
		p.channel.Close()
	}
	if p.connection != nil {
		p.connection.Close()
	}
	return nil
}

// NoOpPublisher is a no-op implementation for testing (Backup kalau RabbitMQ mati)
type NoOpPublisher struct{}

func NewNoOpPublisher() *NoOpPublisher {
	return &NoOpPublisher{}
}

func (p *NoOpPublisher) Publish(ctx context.Context, event *events.PaymentEvent) error {
	log.Printf("[NoOp] Skipping publish: %s for payment %s", event.Type, event.PaymentID)
	return nil
}

func (p *NoOpPublisher) Close() error {
	return nil
}