package handlers

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
)

func TestValidatePaymentMethodRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		code    string
		wantErr bool
	}{
		{
			name:    "reject the real over-length code from the production incident",
			code:    "credit_debit_card_mastercard_visa_jcb_with_manual_confirmation_g002sh", // 69 chars
			wantErr: true,
		},
		{
			name:    "reject 51 chars (one over the limit)",
			code:    strings.Repeat("a", 51),
			wantErr: true,
		},
		{
			name:    "accept exactly 50 chars (the limit)",
			code:    strings.Repeat("a", 50),
			wantErr: false,
		},
		{
			name:    "accept a normal short code",
			code:    "bank_bca",
			wantErr: false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			pm := &entities.PaymentMethodEntity{Code: tc.code}
			err := validatePaymentMethodRequest(pm)
			if tc.wantErr {
				require.Error(t, err)
				var target *handlerValidationError
				require.ErrorAs(t, err, &target, "expected a handlerValidationError (4xx-shaped), got %T", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
