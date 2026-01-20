package dto

// CreatePaymentDTO represents the request to create a payment
type CreatePaymentDTO struct {
	ApplicationID string  `json:"application_id" binding:"required"`
	UserID        string  `json:"user_id" binding:"required"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	Currency      string  `json:"currency" binding:"required"`       // "IDR", "USD", etc.
	PaymentMethod string  `json:"payment_method" binding:"required"` // "credit_card", "bank_transfer", etc.
	Description   string  `json:"description"`
	GatewayName   string  `json:"gateway_name" binding:"required"` // "midtrans", "stripe", etc.

	// Customer information
	CustomerName  string `json:"customer_name" binding:"required"`
	CustomerEmail string `json:"customer_email" binding:"required,email"`
	CustomerPhone string `json:"customer_phone"`

	// Optional: Callback URL for frontend redirect
	CallbackURL string `json:"callback_url"`
}

// PaymentResponseDTO represents the payment response
type PaymentResponseDTO struct {
	ID             string  `json:"id"`
	ApplicationID  string  `json:"application_id"`
	UserID         string  `json:"user_id"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	Status         string  `json:"status"`
	PaymentType    string  `json:"payment_type"`
	PaymentMethod  string  `json:"payment_method"`
	GatewayName    string  `json:"gateway_name"`
	GatewayOrderID string  `json:"gateway_order_id,omitempty"`
	Description    string  `json:"description"`
	RedirectURL    string  `json:"redirect_url,omitempty"` // URL to complete payment
	Token          string  `json:"token,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
	PaidAt         *string `json:"paid_at,omitempty"`
}

// WebhookPayloadDTO represents incoming webhook data
type WebhookPayloadDTO struct {
	RawPayload []byte
	Headers    map[string]string
}
