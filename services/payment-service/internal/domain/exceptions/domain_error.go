package exceptions

// DomainError represents a business logic error
type DomainError struct {
	Message string
	Code    string
}

func (e *DomainError) Error() string {
	return e.Message
}

// NewDomainError creates a new domain error
func NewDomainError(code, message string) *DomainError {
	return &DomainError{
		Code:    code,
		Message: message,
	}
}

// Common domain errors
var (
	ErrPaymentNotFound      = NewDomainError("PAYMENT_NOT_FOUND", "Payment not found")
	ErrInvalidAmount        = NewDomainError("INVALID_AMOUNT", "Payment amount must be greater than 0")
	ErrInvalidCurrency      = NewDomainError("INVALID_CURRENCY", "Invalid currency code")
	ErrPaymentAlreadyPaid   = NewDomainError("PAYMENT_ALREADY_PAID", "Payment has already been paid")
	ErrPaymentGatewayFailed = NewDomainError("GATEWAY_FAILED", "Payment gateway processing failed")
	ErrUnsupportedGateway   = NewDomainError("UNSUPPORTED_GATEWAY", "Payment gateway not supported")
)
