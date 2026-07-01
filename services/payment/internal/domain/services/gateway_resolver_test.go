package services_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/services"
)

// TestResolveGatewayName locks in the precedence ResolveGatewayName already
// implements: explicit GatewayName wins over code-prefix inference, which wins
// over the configured default. This is regression coverage for existing
// correct behavior, not a bug fix; the "stored" half of the gateway-naming
// fix (correcting mislabeled payment_method rows) depends on this precedence
// staying stable once the data is corrected.
func TestResolveGatewayName(t *testing.T) {
	tests := []struct {
		name           string
		method         *entities.PaymentMethodEntity
		defaultGateway string
		expectedName   string
		expectErr      bool
	}{
		{
			name: "manual method always resolves to manual regardless of code/gateway_name",
			method: &entities.PaymentMethodEntity{
				Type:        entities.MethodTypeManual,
				Code:        "bank_bca",
				GatewayName: "xendit",
			},
			expectedName: "manual",
		},
		{
			name: "explicit GatewayName wins even when the code prefix suggests a different gateway",
			method: &entities.PaymentMethodEntity{
				Type:        entities.MethodTypeAutomatic,
				Code:        "midtrans_cc",
				GatewayName: "xendit",
			},
			expectedName: "xendit",
		},
		{
			name: "falls back to code-prefix inference when GatewayName is empty",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "xendit_va",
			},
			expectedName: "xendit",
		},
		{
			name: "falls back to the configured default when neither GatewayName nor code prefix resolve",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "custom_method",
			},
			defaultGateway: "xendit",
			expectedName:   "xendit",
		},
		{
			name: "errors when nothing resolves and there is no default",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "custom_method",
			},
			expectErr: true,
		},
		{
			name:      "errors on a nil method",
			method:    nil,
			expectErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			name, err := services.ResolveGatewayName(tc.method, tc.defaultGateway)
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedName, name)
		})
	}
}
