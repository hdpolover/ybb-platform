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

	ErrPaymentNotRefundable  = NewDomainError("PAYMENT_NOT_REFUNDABLE", "Payment cannot be refunded (status must be success)")
	ErrGatewayError          = NewDomainError("GATEWAY_PROVIDER_ERROR", "Error from upstream payment provider")
	ErrIdempotencyConflict   = NewDomainError("IDEMPOTENCY_CONFLICT", "Idempotency key has already been used for a different request")
	ErrIdempotencyInProgress = NewDomainError("IDEMPOTENCY_IN_PROGRESS", "A request with this idempotency key is already processing")

	ErrDuplicateOpenIntent = NewDomainError("DUPLICATE_OPEN_INTENT", "An open payment intent already exists for this reference")

	// ErrDuplicatePaymentMethod covers the unique constraints on
	// payment_methods.name and .code. Payment methods are shared master data,
	// so the name an admin types is unique across every program — a collision
	// is a normal user input error, not a server fault, and must surface as a
	// 409 rather than an opaque 500.
	ErrDuplicatePaymentMethod = NewDomainError("DUPLICATE_PAYMENT_METHOD", "A payment method with this name already exists")
)
