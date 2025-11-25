package commands

// CreatePaymentCommand represents the command to create a new payment
type CreatePaymentCommand struct {
	ApplicationID string  `json:"application_id" validate:"required"`
	UserID        string  `json:"user_id" validate:"required"`
	Amount        float64 `json:"amount" validate:"required,gt=0"`
	Currency      string  `json:"currency" validate:"required,len=3"`
	PaymentMethod string  `json:"payment_method" validate:"required"`
	GatewayName   string  `json:"gateway_name" validate:"required"`
	CustomerName  string  `json:"customer_name" validate:"required"`
	CustomerEmail string  `json:"customer_email" validate:"required,email"`
	CustomerPhone string  `json:"customer_phone" validate:"required"`
	CallbackURL   string  `json:"callback_url"`
	ReturnURL     string  `json:"return_url"`
}

// NewCreatePaymentCommand creates a new CreatePaymentCommand
func NewCreatePaymentCommand(applicationID, userID string, amount float64, currency, paymentMethod, gatewayName, customerName, customerEmail, customerPhone, callbackURL, returnURL string) *CreatePaymentCommand {
	return &CreatePaymentCommand{
		ApplicationID: applicationID,
		UserID:        userID,
		Amount:        amount,
		Currency:      currency,
		PaymentMethod: paymentMethod,
		GatewayName:   gatewayName,
		CustomerName:  customerName,
		CustomerEmail: customerEmail,
		CustomerPhone: customerPhone,
		CallbackURL:   callbackURL,
		ReturnURL:     returnURL,
	}
}
