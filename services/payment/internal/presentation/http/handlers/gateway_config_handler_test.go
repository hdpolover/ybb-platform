package handlers

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
)

func TestValidateGatewayConfigRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		cfg     entities.GatewayConfig
		wantErr bool
	}{
		{
			name: "reject active xendit with invalid key format",
			cfg: entities.GatewayConfig{
				Provider:      "xendit",
				Mode:          "production",
				ServerKey:     "invalid_key",
				ClientKey:     "unused",
				WebhookSecret: "token",
				IsActive:      true,
			},
			wantErr: true,
		},
		{
			name: "allow inactive xendit draft with invalid key format",
			cfg: entities.GatewayConfig{
				Provider:      "xendit",
				Mode:          "production",
				ServerKey:     "invalid_key",
				ClientKey:     "unused",
				WebhookSecret: "token",
				IsActive:      false,
			},
			wantErr: false,
		},
		{
			name: "accept active xendit with valid production key",
			cfg: entities.GatewayConfig{
				Provider:      "xendit",
				Mode:          "production",
				ServerKey:     "xnd_production_abc123",
				ClientKey:     "unused",
				WebhookSecret: "token",
				IsActive:      true,
			},
			wantErr: false,
		},
		{
			name: "reject active stripe with non live key in production",
			cfg: entities.GatewayConfig{
				Provider:      "stripe",
				Mode:          "production",
				ServerKey:     "sk_test_abc123",
				ClientKey:     "pk_live_abc123",
				WebhookSecret: "",
				IsActive:      true,
			},
			wantErr: true,
		},
		{
			name: "accept active midtrans sandbox keys",
			cfg: entities.GatewayConfig{
				Provider:      "midtrans",
				Mode:          "sandbox",
				ServerKey:     "SB-Mid-server-abc123",
				ClientKey:     "SB-Mid-client-abc123",
				WebhookSecret: "",
				IsActive:      true,
			},
			wantErr: false,
		},
		// Regression: the provider allow-list used to run only inside the
		// IsActive branch. An inactive config with an unrecognized/oversized
		// provider skipped it entirely and reached the DB write, overflowing
		// payment_gateway_configs.provider (varchar(50)) as a 500.
		{
			name: "reject inactive config with oversized unsupported provider",
			cfg: entities.GatewayConfig{
				Provider:      strings.Repeat("a", 54),
				Mode:          "sandbox",
				ServerKey:     "unused",
				ClientKey:     "unused",
				WebhookSecret: "",
				IsActive:      false,
			},
			wantErr: true,
		},
		{
			name: "reject inactive config with unsupported provider name",
			cfg: entities.GatewayConfig{
				Provider:      "not_a_real_gateway",
				Mode:          "sandbox",
				ServerKey:     "unused",
				ClientKey:     "unused",
				WebhookSecret: "",
				IsActive:      false,
			},
			wantErr: true,
		},
		{
			name: "allow inactive config with recognized provider and placeholder keys",
			cfg: entities.GatewayConfig{
				Provider:      "midtrans",
				Mode:          "sandbox",
				ServerKey:     "placeholder",
				ClientKey:     "placeholder",
				WebhookSecret: "",
				IsActive:      false,
			},
			wantErr: false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := validateGatewayConfigRequest(&tc.cfg)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// Read responses must never carry decrypted gateway credentials.
func TestRedactGatewayConfigMasksSecrets(t *testing.T) {
	t.Parallel()

	redacted := redactGatewayConfig(entities.GatewayConfig{
		Provider:      "xendit",
		ServerKey:     "xnd_production_abc123",
		ClientKey:     "unused",
		WebhookSecret: "cb",
	})

	require.Equal(t, "****c123", redacted.ServerKey)
	require.Equal(t, "****used", redacted.ClientKey)
	require.Equal(t, "****", redacted.WebhookSecret, "values too short to reveal a tail are blanked to the bare mask")
	require.Equal(t, "xendit", redacted.Provider, "non-secret fields stay intact so the form still loads")
}

// Because GET serves a mask, an edit form submitted without touching the key
// fields sends that mask back. Writing it through would destroy a live key.
func TestKeepSecretIfMaskedPreservesStoredValue(t *testing.T) {
	t.Parallel()

	stored := "xnd_production_abc123"
	require.Equal(t, stored, keepSecretIfMasked(maskSecret(stored), stored))
	require.Equal(t, "xnd_production_new999", keepSecretIfMasked("xnd_production_new999", stored))
	require.Equal(t, "", keepSecretIfMasked("", stored), "an explicitly cleared field still clears")
}
