package persistence

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	"github.com/ybb-platform/payment/internal/domain/repositories"
)

// PostgresPaymentRepository implements PaymentRepository using PostgreSQL
type PostgresPaymentRepository struct {
	db *sql.DB
}

// NewPostgresPaymentRepository creates a new PostgreSQL payment repository
func NewPostgresPaymentRepository(db *sql.DB) repositories.PaymentRepository {
	return &PostgresPaymentRepository{
		db: db,
	}
}

// Create saves a new payment to the database
func (r *PostgresPaymentRepository) Create(ctx context.Context, payment *entities.Payment) error {
	query := `
		INSERT INTO payments (
			id, application_id, user_id, amount, currency, 
			status, payment_method, gateway_name, gateway_order_id,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := r.db.ExecContext(
		ctx,
		query,
		payment.ID,
		payment.ApplicationID,
		payment.UserID,
		payment.Amount,
		payment.Currency,
		payment.Status,
		payment.PaymentMethod,
		payment.GatewayName,
		payment.GatewayOrderID,
		payment.CreatedAt,
		payment.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to create payment: %v", err)
		return fmt.Errorf("failed to create payment: %w", err)
	}

	return nil
}

// FindByID retrieves a payment by its ID
func (r *PostgresPaymentRepository) FindByID(ctx context.Context, id string) (*entities.Payment, error) {
	query := `
		SELECT id, application_id, user_id, amount, currency, 
			   status, payment_method, gateway_name, gateway_order_id,
			   created_at, updated_at, paid_at
		FROM payments 
		WHERE id = $1
	`

	payment := &entities.Payment{}
	var paidAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&payment.ID,
		&payment.ApplicationID,
		&payment.UserID,
		&payment.Amount,
		&payment.Currency,
		&payment.Status,
		&payment.PaymentMethod,
		&payment.GatewayName,
		&payment.GatewayOrderID,
		&payment.CreatedAt,
		&payment.UpdatedAt,
		&paidAt,
	)

	if err == sql.ErrNoRows {
		return nil, exceptions.ErrPaymentNotFound
	}

	if err != nil {
		log.Printf("Failed to find payment: %v", err)
		return nil, fmt.Errorf("failed to find payment: %w", err)
	}

	if paidAt.Valid {
		payment.PaidAt = &paidAt.Time
	}

	return payment, nil
}

// Update updates an existing payment
func (r *PostgresPaymentRepository) Update(ctx context.Context, payment *entities.Payment) error {
	query := `
		UPDATE payments 
		SET status = $2, 
		    gateway_order_id = $3,
		    updated_at = $4,
		    paid_at = $5
		WHERE id = $1
	`

	_, err := r.db.ExecContext(
		ctx,
		query,
		payment.ID,
		payment.Status,
		payment.GatewayOrderID,
		payment.UpdatedAt,
		payment.PaidAt,
	)

	if err != nil {
		log.Printf("Failed to update payment: %v", err)
		return fmt.Errorf("failed to update payment: %w", err)
	}

	return nil
}

// UpdateProof updates the proof of payment
func (r *PostgresPaymentRepository) UpdateProof(ctx context.Context, id string, fileID string, fileURL string) error {
	query := `
		UPDATE payments 
		SET proof_file_id = $2, 
		    proof_file_url = $3, 
		    status = 'processing',
		    updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, id, fileID, fileURL)
	if err != nil {
		log.Printf("Failed to update payment proof: %v", err)
		return fmt.Errorf("failed to update payment proof: %w", err)
	}

	return nil
}

// FindByGatewayOrderID finds a payment by the gateway's order ID
func (r *PostgresPaymentRepository) FindByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	query := `
		SELECT id, application_id, user_id, amount, currency, 
			   status, payment_method, gateway_name, gateway_order_id,
			   created_at, updated_at, paid_at
		FROM payments 
		WHERE gateway_order_id = $1
	`

	payment := &entities.Payment{}
	var paidAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, gatewayOrderID).Scan(
		&payment.ID,
		&payment.ApplicationID,
		&payment.UserID,
		&payment.Amount,
		&payment.Currency,
		&payment.Status,
		&payment.PaymentMethod,
		&payment.GatewayName,
		&payment.GatewayOrderID,
		&payment.CreatedAt,
		&payment.UpdatedAt,
		&paidAt,
	)

	if err == sql.ErrNoRows {
		return nil, exceptions.ErrPaymentNotFound
	}

	if err != nil {
		log.Printf("Failed to find payment by gateway order ID: %v", err)
		return nil, fmt.Errorf("failed to find payment: %w", err)
	}

	if paidAt.Valid {
		payment.PaidAt = &paidAt.Time
	}

	return payment, nil
}

// FindByApplicationID retrieves all payments for a specific application
func (r *PostgresPaymentRepository) FindByApplicationID(ctx context.Context, applicationID string) ([]*entities.Payment, error) {
	query := `
		SELECT id, application_id, user_id, amount, currency, 
			   status, payment_method, gateway_name, gateway_order_id,
			   created_at, updated_at, paid_at
		FROM payments 
		WHERE application_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, applicationID)
	if err != nil {
		log.Printf("Failed to find payments by application ID: %v", err)
		return nil, fmt.Errorf("failed to find payments: %w", err)
	}
	defer rows.Close()

	var payments []*entities.Payment
	for rows.Next() {
		payment := &entities.Payment{}
		var paidAt sql.NullTime

		if err := rows.Scan(
			&payment.ID,
			&payment.ApplicationID,
			&payment.UserID,
			&payment.Amount,
			&payment.Currency,
			&payment.Status,
			&payment.PaymentMethod,
			&payment.GatewayName,
			&payment.GatewayOrderID,
			&payment.CreatedAt,
			&payment.UpdatedAt,
			&paidAt,
		); err != nil {
			log.Printf("Failed to scan payment: %v", err)
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		if paidAt.Valid {
			payment.PaidAt = &paidAt.Time
		}
		payments = append(payments, payment)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error during rows iteration: %v", err)
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return payments, nil
}

// FindByUserID retrieves all payments for a specific user
func (r *PostgresPaymentRepository) FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Payment, error) {
	query := `
		SELECT id, application_id, user_id, amount, currency, 
			   status, payment_method, gateway_name, gateway_order_id,
			   created_at, updated_at, paid_at
		FROM payments 
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		log.Printf("Failed to find payments by user ID: %v", err)
		return nil, fmt.Errorf("failed to find payments: %w", err)
	}
	defer rows.Close()

	var payments []*entities.Payment
	for rows.Next() {
		payment := &entities.Payment{}
		var paidAt sql.NullTime

		if err := rows.Scan(
			&payment.ID,
			&payment.ApplicationID,
			&payment.UserID,
			&payment.Amount,
			&payment.Currency,
			&payment.Status,
			&payment.PaymentMethod,
			&payment.GatewayName,
			&payment.GatewayOrderID,
			&payment.CreatedAt,
			&payment.UpdatedAt,
			&paidAt,
		); err != nil {
			log.Printf("Failed to scan payment: %v", err)
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		if paidAt.Valid {
			payment.PaidAt = &paidAt.Time
		}
		payments = append(payments, payment)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error during rows iteration: %v", err)
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return payments, nil
}
