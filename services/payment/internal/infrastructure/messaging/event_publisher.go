package messaging

import (
	"context"
	"fmt"
	"log"
	"sync"

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
	mu         sync.Mutex
	connection *amqp.Connection
	channel    *amqp.Channel
	exchange   string
	url        string
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
		url:        rabbitMQURL,
	}, nil
}

// reconnect re-establishes the connection and channel.
// Must be called with p.mu held.
func (p *RabbitMQPublisher) reconnect() error {
	log.Printf("[RabbitMQ] Reconnecting to exchange '%s'", p.exchange)

	// Close stale resources before re-dialing (ignore errors — they may already be closed).
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.connection != nil {
		_ = p.connection.Close()
	}

	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("failed to reconnect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("failed to open channel on reconnect: %w", err)
	}

	if err = ch.ExchangeDeclare(
		p.exchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return fmt.Errorf("failed to declare exchange on reconnect: %w", err)
	}

	p.connection = conn
	p.channel = ch
	log.Printf("[RabbitMQ] Reconnected successfully to exchange '%s'", p.exchange)
	return nil
}

// publish sends a single message on the current channel.
// Must be called with p.mu held.
func (p *RabbitMQPublisher) publish(ctx context.Context, routingKey string, body []byte, event *events.PaymentEvent) error {
	return p.channel.PublishWithContext(
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

	p.mu.Lock()
	defer p.mu.Unlock()

	// 3. Reconnect if channel is closed before attempting publish.
	if p.channel == nil || p.channel.IsClosed() {
		if reconnErr := p.reconnect(); reconnErr != nil {
			return fmt.Errorf("failed to publish event (channel closed, reconnect failed): %w", reconnErr)
		}
	}

	// 4. Publish to RabbitMQ; on failure, attempt one reconnect + retry.
	if err = p.publish(ctx, routingKey, body, event); err != nil {
		log.Printf("[RabbitMQ] Publish error, attempting reconnect: %v", err)
		if reconnErr := p.reconnect(); reconnErr != nil {
			return fmt.Errorf("failed to publish event (reconnect failed): %w", reconnErr)
		}
		if err = p.publish(ctx, routingKey, body, event); err != nil {
			return fmt.Errorf("failed to publish event after reconnect: %w", err)
		}
	}

	return nil
}

// Close closes the RabbitMQ connection
func (p *RabbitMQPublisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.connection != nil {
		_ = p.connection.Close()
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