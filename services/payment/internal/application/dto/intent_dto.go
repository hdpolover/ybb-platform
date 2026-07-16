package dto

type CreateIntentRequest struct {
	UserID        string                 `json:"user_id" binding:"required"`
	ParticipantID string                 `json:"participant_id"`
	ReferenceType string                 `json:"reference_type" binding:"required"` // e.g. "application"
	ReferenceID   string                 `json:"reference_id" binding:"required"`   // e.g. "app_123"
	Amount        float64                `json:"amount" binding:"required,gt=0"`
	Currency      string                 `json:"currency" binding:"required,len=3"` // e.g. "IDR"
	Metadata      map[string]interface{} `json:"metadata"`
}

type CreateIntentResponse struct {
	IntentID     string `json:"intent_id"`
	ClientSecret string `json:"client_secret,omitempty"` // For Stripe/Midtrans handling on client
	Status       string `json:"status"`
}

type ConfirmPaymentRequest struct {
	PaymentMethodID string                 `json:"payment_method_id" binding:"required"` // e.g. "bca_va"
	GatewayToken    string                 `json:"gateway_token"`                        // Token from client-side JS
	PaymentDetails  map[string]interface{} `json:"payment_details"`                      // Extra data
	CustomerDetails *CustomerDetailsDTO    `json:"customer_details,omitempty"`
}

type CustomerDetailsDTO struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type ConfirmPaymentResponse struct {
	TransactionID string                 `json:"transaction_id"`
	Status        string                 `json:"status"`
	Action        *PaymentActionDTO      `json:"action,omitempty"`           // If redirect needed
	GatewayResp   map[string]interface{} `json:"gateway_response,omitempty"` // Debug/Raw
}

type PaymentActionDTO struct {
	Type   string `json:"type"` // "redirect", "display_qr"
	URL    string `json:"url,omitempty"`
	QRCode string `json:"qr_code,omitempty"`
}
