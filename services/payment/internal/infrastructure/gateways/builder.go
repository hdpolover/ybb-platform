// services/payment/internal/infrastructure/gateways/builder.go
package gateways

import (
	"fmt"

	"github.com/ybb-platform/payment/internal/domain/entities"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// EnvCredentials is a provider's env-var fallback, shaped like a DB config row
// (PayPal: ServerKey=client id, ClientKey=secret; Xendit: WebhookSecret=callback token).
type EnvCredentials struct {
	Provider      string
	ServerKey     string
	ClientKey     string
	WebhookSecret string
	Mode          string
}

// BuildGateway constructs the provider gateway from stored-config style credentials.
func BuildGateway(provider, serverKey, clientKey, webhookSecret, mode string) (domainGateways.PaymentGateway, error) {
	switch provider {
	case "midtrans":
		return NewMidtransGateway(serverKey, clientKey, mode), nil
	case "xendit":
		return NewXenditGateway(serverKey, webhookSecret), nil // callback token lives in webhook_secret
	case "stripe":
		return NewStripeGateway(serverKey), nil
	case "paypal":
		return NewPayPalGateway(serverKey, clientKey, mode)
	default:
		return nil, fmt.Errorf("unknown provider %q", provider)
	}
}

// BuildEntries turns env fallbacks and DB configs into factory entries.
// Order matters: Replace lets a later global entry win, so env comes first and DB
// overrides it, exactly like the old registerGateways. Env entries are virtual
// global configs with no id. A config that cannot be built is skipped with a warning.
func BuildEntries(env []EnvCredentials, dbConfigs []entities.GatewayConfig, warnf func(format string, args ...any)) []ConfigEntry {
	entries := []ConfigEntry{{Provider: "manual", IsActive: true, Gateway: NewManualGateway()}}

	for _, e := range env {
		gw, err := BuildGateway(e.Provider, e.ServerKey, e.ClientKey, e.WebhookSecret, e.Mode)
		if err != nil {
			warnf("Skipping %s env gateway registration: %v", e.Provider, err)
			continue
		}
		entries = append(entries, ConfigEntry{Provider: e.Provider, IsActive: true, Gateway: gw})
	}

	for _, c := range dbConfigs {
		gw, err := BuildGateway(c.Provider, c.ServerKey, c.ClientKey, c.WebhookSecret, c.Mode)
		if err != nil {
			warnf("Skipping gateway config %s (%s): %v", c.ID, c.Provider, err)
			continue
		}
		entries = append(entries, ConfigEntry{
			ID: c.ID, Provider: c.Provider, BrandID: c.BrandID, ProgramID: c.ProgramID,
			IsActive: c.IsActive, Gateway: gw,
		})
	}
	return entries
}
