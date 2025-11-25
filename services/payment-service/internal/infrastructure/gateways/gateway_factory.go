package gateways

import (
	"fmt"
	"sync"

	"github.com/ybb-platform/payment-service/internal/domain/exceptions"
	domainGateways "github.com/ybb-platform/payment-service/internal/domain/gateways"
)

// GatewayFactory creates payment gateway instances
type GatewayFactory struct {
	gateways map[string]domainGateways.PaymentGateway
	mu       sync.RWMutex
}

// NewGatewayFactory creates a new gateway factory
func NewGatewayFactory() *GatewayFactory {
	return &GatewayFactory{
		gateways: make(map[string]domainGateways.PaymentGateway),
	}
}

// Register registers a payment gateway
func (f *GatewayFactory) Register(gateway domainGateways.PaymentGateway) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.gateways[gateway.GetName()] = gateway
}

// GetGateway returns a payment gateway by name
func (f *GatewayFactory) GetGateway(name string) (domainGateways.PaymentGateway, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	gateway, exists := f.gateways[name]
	if !exists {
		return nil, fmt.Errorf("%w: %s", exceptions.ErrUnsupportedGateway, name)
	}
	return gateway, nil
}

// ListAvailableGateways returns list of available gateway names
func (f *GatewayFactory) ListAvailableGateways() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	names := make([]string, 0, len(f.gateways))
	for name := range f.gateways {
		names = append(names, name)
	}
	return names
}
