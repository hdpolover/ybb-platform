package messaging

import (
	"context"
	"log"

	"github.com/ybb-platform/payment-service/internal/domain/events"
)

// EventPublisher defines the interface for publishing events
type EventPublisher interface {
	Publish(ctx context.Context, event *events.PaymentEvent) error
	Close() error
}

// RabbitMQPublisher implements EventPublisher using RabbitMQ
// TODO for intern: Implement RabbitMQ connection and publishing
type RabbitMQPublisher struct {
	// TODO: Add RabbitMQ connection fields
	// connection *amqp.Connection
	// channel    *amqp.Channel
	exchange string
}

// NewRabbitMQPublisher creates a new RabbitMQ event publisher
// TODO for intern: Initialize RabbitMQ connection
func NewRabbitMQPublisher(rabbitMQURL, exchange string) (*RabbitMQPublisher, error) {
	// TODO: Connect to RabbitMQ
	// conn, err := amqp.Dial(rabbitMQURL)
	// if err != nil {
	//     return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	// }
	//
	// ch, err := conn.Channel()
	// if err != nil {
	//     return nil, fmt.Errorf("failed to open channel: %w", err)
	// }
	//
	// // Declare exchange
	// err = ch.ExchangeDeclare(
	//     exchange,
	//     "topic",
	//     true,
	//     false,
	//     false,
	//     false,
	//     nil,
	// )
	// if err != nil {
	//     return nil, fmt.Errorf("failed to declare exchange: %w", err)
	// }

	return &RabbitMQPublisher{
		exchange: exchange,
	}, nil
}

// Publish publishes an event to RabbitMQ
// TODO for intern: Implement actual RabbitMQ publishing
func (p *RabbitMQPublisher) Publish(ctx context.Context, event *events.PaymentEvent) error {
	// For now, just log the event
	log.Printf("Publishing event: %s for payment %s", event.Type, event.PaymentID)

	// TODO: Implement actual publishing
	// body, err := event.ToJSON()
	// if err != nil {
	//     return fmt.Errorf("failed to marshal event: %w", err)
	// }
	//
	// err = p.channel.PublishWithContext(
	//     ctx,
	//     p.exchange,
	//     string(event.Type), // routing key
	//     false,
	//     false,
	//     amqp.Publishing{
	//         ContentType:  "application/json",
	//         Body:         body,
	//         DeliveryMode: amqp.Persistent,
	//     },
	// )
	// if err != nil {
	//     return fmt.Errorf("failed to publish event: %w", err)
	// }

	return nil
}

// Close closes the RabbitMQ connection
func (p *RabbitMQPublisher) Close() error {
	// TODO: Close RabbitMQ connection
	// if p.channel != nil {
	//     p.channel.Close()
	// }
	// if p.connection != nil {
	//     p.connection.Close()
	// }
	return nil
}

// NoOpPublisher is a no-op implementation for testing
type NoOpPublisher struct{}

// NewNoOpPublisher creates a new no-op publisher
func NewNoOpPublisher() *NoOpPublisher {
	return &NoOpPublisher{}
}

// Publish does nothing
func (p *NoOpPublisher) Publish(ctx context.Context, event *events.PaymentEvent) error {
	log.Printf("NoOp: Publishing event: %s for payment %s", event.Type, event.PaymentID)
	return nil
}

// Close does nothing
func (p *NoOpPublisher) Close() error {
	return nil
}
