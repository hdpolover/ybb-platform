package services

import (
	"fmt"
	"strings"

	"github.com/ybb-platform/payment/internal/domain/entities"
)

func ResolveGatewayName(method *entities.PaymentMethodEntity, defaultAutomaticGateway string) (string, error) {
	if method == nil {
		return "", fmt.Errorf("payment method is required")
	}

	if method.Type.IsManual() {
		return "manual", nil
	}

	if gatewayName := normalizeGatewayName(method.GatewayName); gatewayName != "" {
		return gatewayName, nil
	}

	if gatewayName := inferGatewayNameFromCode(method.Code); gatewayName != "" {
		return gatewayName, nil
	}

	if gatewayName := normalizeGatewayName(defaultAutomaticGateway); gatewayName != "" {
		return gatewayName, nil
	}

	return "", fmt.Errorf("payment method %q does not specify a gateway provider", method.Code)
}

func inferGatewayNameFromCode(code string) string {
	normalized := strings.ToLower(strings.TrimSpace(code))
	for _, prefix := range []string{"midtrans", "xendit", "stripe", "paypal"} {
		if strings.HasPrefix(normalized, prefix+"_") || normalized == prefix {
			return prefix
		}
	}

	return ""
}

func normalizeGatewayName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// RequiresIDRCurrency reports whether the named gateway settles exclusively in IDR.
// These gateways cannot charge USD directly and require an exchange rate when the
// invoice currency is USD so the service can convert the amount before charging.
func RequiresIDRCurrency(gatewayName string) bool {
	switch strings.ToLower(strings.TrimSpace(gatewayName)) {
	case "midtrans", "xendit":
		return true
	default:
		return false
	}
}
