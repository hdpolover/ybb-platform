package handlers

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
)

func TestValidatePaymentMethodRequest(t *testing.T) {
	t.Parallel()

	const validName = "Bank Transfer BCA (Manual)"

	tests := []struct {
		name        string
		code        string
		methodName  string
		displayName string
		wantErr     bool
	}{
		{
			name:       "reject the real over-length code from the production incident",
			code:       "credit_debit_card_mastercard_visa_jcb_with_manual_confirmation_g002sh", // 69 chars
			methodName: validName,
			wantErr:    true,
		},
		{
			name:       "reject 51 chars (one over the limit)",
			code:       strings.Repeat("a", 51),
			methodName: validName,
			wantErr:    true,
		},
		{
			name:       "accept exactly 50 chars (the limit)",
			code:       strings.Repeat("a", 50),
			methodName: validName,
			wantErr:    false,
		},
		{
			name:       "accept a normal short code",
			code:       "bank_bca",
			methodName: validName,
			wantErr:    false,
		},
		{
			name:       "reject an empty name",
			code:       "bank_bca",
			methodName: "",
			wantErr:    true,
		},
		{
			name:       "reject a whitespace-only name",
			code:       "bank_bca",
			methodName: "   ",
			wantErr:    true,
		},
		{
			name:       "reject 101 chars of name (varchar(100) would raise 22001)",
			code:       "bank_bca",
			methodName: strings.Repeat("a", 101),
			wantErr:    true,
		},
		{
			name:       "accept exactly 100 chars of name",
			code:       "bank_bca",
			methodName: strings.Repeat("a", 100),
			wantErr:    false,
		},
		{
			name:        "reject 101 chars of display name",
			code:        "bank_bca",
			methodName:  validName,
			displayName: strings.Repeat("a", 101),
			wantErr:     true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			pm := &entities.PaymentMethodEntity{
				Code:        tc.code,
				Name:        tc.methodName,
				DisplayName: tc.displayName,
			}
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

// Trailing whitespace defeated uni_payment_methods_name in production: two
// live rows named "Credit / Debit Card (Mastercard / Visa / JCB)" differing
// only by a trailing space. Trimming on write is what stops that recurring.
func TestNormalisePaymentMethodRequestTrimsUniqueFields(t *testing.T) {
	t.Parallel()

	pm := &entities.PaymentMethodEntity{
		Name:        "  Credit / Debit Card (Mastercard / Visa / JCB) ",
		DisplayName: " Credit / Debit Card  ",
		Code:        " credit_debit_card_ab12cd ",
	}

	normalisePaymentMethodRequest(pm)

	require.Equal(t, "Credit / Debit Card (Mastercard / Visa / JCB)", pm.Name)
	require.Equal(t, "Credit / Debit Card", pm.DisplayName)
	require.Equal(t, "credit_debit_card_ab12cd", pm.Code)
}

// The message must name the method AND point at the per-program enable
// toggle: admins hit this while trying to add a method to their own program,
// and "already exists" alone reads as a dead end.
func TestDuplicatePaymentMethodMessageIsActionable(t *testing.T) {
	t.Parallel()

	msg := duplicatePaymentMethodMessage("Mastercard / Visa / JCB (Manual Confirmation)")

	require.Contains(t, msg, "Mastercard / Visa / JCB (Manual Confirmation)")
	require.Contains(t, msg, "shared across all programs")
	require.Contains(t, msg, "enable the existing one for this program")
}
