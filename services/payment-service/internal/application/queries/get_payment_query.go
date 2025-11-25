package queries

// GetPaymentByIDQuery represents a query to get a payment by ID
type GetPaymentByIDQuery struct {
	PaymentID string `validate:"required"`
}

// NewGetPaymentByIDQuery creates a new GetPaymentByIDQuery
func NewGetPaymentByIDQuery(paymentID string) *GetPaymentByIDQuery {
	return &GetPaymentByIDQuery{
		PaymentID: paymentID,
	}
}

// GetPaymentsByUserIDQuery represents a query to get payments by user ID
type GetPaymentsByUserIDQuery struct {
	UserID string `validate:"required"`
	Limit  int    `validate:"required,gt=0,lte=100"`
	Offset int    `validate:"gte=0"`
}

// NewGetPaymentsByUserIDQuery creates a new GetPaymentsByUserIDQuery
func NewGetPaymentsByUserIDQuery(userID string, limit, offset int) *GetPaymentsByUserIDQuery {
	return &GetPaymentsByUserIDQuery{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	}
}

// GetPaymentsByApplicationIDQuery represents a query to get payments by application ID
type GetPaymentsByApplicationIDQuery struct {
	ApplicationID string `validate:"required"`
}

// NewGetPaymentsByApplicationIDQuery creates a new GetPaymentsByApplicationIDQuery
func NewGetPaymentsByApplicationIDQuery(applicationID string) *GetPaymentsByApplicationIDQuery {
	return &GetPaymentsByApplicationIDQuery{
		ApplicationID: applicationID,
	}
}
