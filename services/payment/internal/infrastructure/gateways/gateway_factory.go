package gateways

import (
	"fmt"
	"sync"

	"github.com/ybb-platform/payment/internal/domain/exceptions"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// ConfigEntry is one gateway config in a runtime snapshot. ID is empty for
// virtual configs (env fallbacks, the manual gateway). Scope is global when both
// BrandID and ProgramID are nil.
type ConfigEntry struct {
	ID        string
	Provider  string
	BrandID   *string
	ProgramID *string
	IsActive  bool
	Gateway   domainGateways.PaymentGateway
}

// scopeKey indexes active brand/program overrides: "brand|<provider>|<id>".
func scopeKey(kind, provider, id string) string { return kind + "|" + provider + "|" + id }

// GatewayFactory serves payment gateways. The global/env gateways live in
// `gateways` (what GetGateway has always served); brand/program overrides live
// in `scoped`, and every DB config by id (inactive too) lives in `byID`.
type GatewayFactory struct {
	gateways map[string]domainGateways.PaymentGateway
	scoped   map[string]ConfigEntry
	byID     map[string]ConfigEntry
	loaded   bool
	mu       sync.RWMutex
}

// NewGatewayFactory creates a new gateway factory
func NewGatewayFactory() *GatewayFactory {
	return &GatewayFactory{
		gateways: make(map[string]domainGateways.PaymentGateway),
		scoped:   make(map[string]ConfigEntry),
		byID:     make(map[string]ConfigEntry),
	}
}

// Register registers a global payment gateway
func (f *GatewayFactory) Register(gateway domainGateways.PaymentGateway) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.gateways[gateway.GetName()] = gateway
}

// Reset clears everything. Prefer Replace for refreshes: Reset leaves a window
// where lookups fail.
func (f *GatewayFactory) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.gateways = make(map[string]domainGateways.PaymentGateway)
	f.scoped = make(map[string]ConfigEntry)
	f.byID = make(map[string]ConfigEntry)
	f.loaded = false
}

// Replace atomically swaps in a complete snapshot built from entries. Maps are
// built outside the lock, so readers see the old or the new generation, never a
// partial one. Among active global entries of a provider the last one wins.
func (f *GatewayFactory) Replace(entries []ConfigEntry) {
	global := make(map[string]domainGateways.PaymentGateway)
	scoped := make(map[string]ConfigEntry)
	byID := make(map[string]ConfigEntry)

	for _, e := range entries {
		if e.ID != "" {
			byID[e.ID] = e
		}
		if !e.IsActive {
			continue
		}
		switch {
		case e.ProgramID != nil:
			scoped[scopeKey("program", e.Provider, *e.ProgramID)] = e
		case e.BrandID != nil:
			scoped[scopeKey("brand", e.Provider, *e.BrandID)] = e
		default:
			global[e.Provider] = e.Gateway
		}
	}

	f.mu.Lock()
	f.gateways, f.scoped, f.byID, f.loaded = global, scoped, byID, true
	f.mu.Unlock()
}

// HasSnapshot reports whether Replace has succeeded at least once.
func (f *GatewayFactory) HasSnapshot() bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.loaded
}

// GetGateway returns the global (DB-global, else env) gateway for a provider.
func (f *GatewayFactory) GetGateway(name string) (domainGateways.PaymentGateway, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	gateway, exists := f.gateways[name]
	if !exists {
		return nil, fmt.Errorf("%w: %s", exceptions.ErrUnsupportedGateway, name)
	}
	return gateway, nil
}

// Resolve picks the gateway for provider using program -> brand -> global -> env.
// The returned config id is non-nil only when a brand/program override was chosen
// (that is what a transaction pins); global and env resolve to a nil id.
func (f *GatewayFactory) Resolve(provider, programID, brandID string) (domainGateways.PaymentGateway, *string, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if programID != "" {
		if e, ok := f.scoped[scopeKey("program", provider, programID)]; ok {
			return e.Gateway, idPtr(e.ID), nil
		}
	}
	if brandID != "" {
		if e, ok := f.scoped[scopeKey("brand", provider, brandID)]; ok {
			return e.Gateway, idPtr(e.ID), nil
		}
	}
	if gw, ok := f.gateways[provider]; ok {
		return gw, nil, nil
	}
	return nil, nil, fmt.Errorf("%w: %s", exceptions.ErrUnsupportedGateway, provider)
}

// GetGatewayByConfigID returns the gateway built from a specific config, inactive
// or not, so a transaction pinned to a rotated-out config still reaches its
// credentials. Soft-deleted configs are not in the snapshot and return an error.
func (f *GatewayFactory) GetGatewayByConfigID(id string) (domainGateways.PaymentGateway, string, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	e, ok := f.byID[id]
	if !ok {
		return nil, "", fmt.Errorf("%w: gateway config %s", exceptions.ErrUnsupportedGateway, id)
	}
	return e.Gateway, e.Provider, nil
}

func idPtr(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}

// HasProvider reports whether any active config of the provider exists at any
// scope (global, env, brand or program). Used to decide whether a payment method
// is worth showing; the exact gateway is picked per payment by Resolve.
func (f *GatewayFactory) HasProvider(provider string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if _, ok := f.gateways[provider]; ok {
		return true
	}
	for _, e := range f.scoped {
		if e.Provider == provider {
			return true
		}
	}
	return false
}

// ListAvailableGateways returns list of available global gateway names
func (f *GatewayFactory) ListAvailableGateways() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	names := make([]string, 0, len(f.gateways))
	for name := range f.gateways {
		names = append(names, name)
	}
	return names
}
