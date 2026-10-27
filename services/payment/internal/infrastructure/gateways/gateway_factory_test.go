// services/payment/internal/infrastructure/gateways/gateway_factory_test.go
package gateways

import (
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/exceptions"
	domainGateways "github.com/ybb-platform/payment/internal/domain/gateways"
)

// fakeGW satisfies PaymentGateway by embedding the interface; only GetName is real.
type fakeGW struct {
	domainGateways.PaymentGateway
	name  string
	label string
}

func (g fakeGW) GetName() string { return g.name }

func str(s string) *string { return &s }

func entry(id, provider, label string, brand, program *string, active bool) ConfigEntry {
	return ConfigEntry{
		ID: id, Provider: provider, BrandID: brand, ProgramID: program, IsActive: active,
		Gateway: fakeGW{name: provider, label: label},
	}
}

func labelOf(t *testing.T, gw domainGateways.PaymentGateway) string {
	t.Helper()
	return gw.(fakeGW).label
}

func TestResolvePrecedence(t *testing.T) {
	const prog, brand, otherProg, otherBrand = "p1", "b1", "p2", "b2"
	entries := []ConfigEntry{
		entry("", "xendit", "env", nil, nil, true),
		entry("g1", "xendit", "global-db", nil, nil, true),
		entry("b1cfg", "xendit", "brand", str(brand), nil, true),
		entry("p1cfg", "xendit", "program", nil, str(prog), true),
		entry("p1off", "midtrans", "program-inactive", nil, str("p1"), false),
		entry("", "midtrans", "midtrans-env", nil, nil, true),
		entry("", "stripe", "stripe-env", nil, nil, true),
	}
	f := NewGatewayFactory()
	f.Replace(entries)

	tests := []struct {
		name         string
		provider     string
		program      string
		brand        string
		wantLabel    string
		wantConfigID *string
		wantErr      bool
	}{
		{"program beats brand and global", "xendit", prog, brand, "program", str("p1cfg"), false},
		{"brand beats global when no program override", "xendit", otherProg, brand, "brand", str("b1cfg"), false},
		{"global db beats env, id stays nil", "xendit", otherProg, otherBrand, "global-db", nil, false},
		{"empty scope ids resolve global", "xendit", "", "", "global-db", nil, false},
		{"inactive scoped config skipped, falls to env", "midtrans", prog, brand, "midtrans-env", nil, false},
		{"scoped config for another provider is ignored", "stripe", prog, brand, "stripe-env", nil, false},
		{"unknown provider errors", "paypal", prog, brand, "", nil, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gw, id, err := f.Resolve(tc.provider, tc.program, tc.brand)
			if tc.wantErr {
				require.Error(t, err)
				require.True(t, errors.Is(err, exceptions.ErrUnsupportedGateway))
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantLabel, labelOf(t, gw))
			require.Equal(t, tc.wantConfigID, id)
		})
	}
}

func TestResolveFallsBackToRegisteredGateway(t *testing.T) {
	f := NewGatewayFactory()
	f.Register(fakeGW{name: "xendit", label: "registered"})
	gw, id, err := f.Resolve("xendit", "p", "b")
	require.NoError(t, err)
	require.Nil(t, id)
	require.Equal(t, "registered", labelOf(t, gw))
}

func TestGetGatewayMatchesLegacyBehaviourAfterReplace(t *testing.T) {
	f := NewGatewayFactory()
	f.Replace([]ConfigEntry{
		entry("", "xendit", "env", nil, nil, true),
		entry("g1", "xendit", "global-db", nil, nil, true),
		entry("p1cfg", "xendit", "program", nil, str("p1"), true),
		entry("g2", "midtrans", "inactive-global", nil, nil, false),
	})
	gw, err := f.GetGateway("xendit")
	require.NoError(t, err)
	require.Equal(t, "global-db", labelOf(t, gw))
	_, err = f.GetGateway("midtrans")
	require.Error(t, err)
	require.ElementsMatch(t, []string{"xendit"}, f.ListAvailableGateways())
}

func TestGetGatewayByConfigIDServesInactiveNotMissing(t *testing.T) {
	f := NewGatewayFactory()
	f.Replace([]ConfigEntry{
		entry("active-1", "xendit", "a", str("b1"), nil, true),
		entry("inactive-1", "xendit", "i", str("b1"), nil, false),
	})

	gw, provider, err := f.GetGatewayByConfigID("inactive-1")
	require.NoError(t, err)
	require.Equal(t, "xendit", provider)
	require.Equal(t, "i", labelOf(t, gw))

	// Inactive configs must never win a fresh Resolve.
	gw, id, err := f.Resolve("xendit", "", "b1")
	require.NoError(t, err)
	require.Equal(t, "a", labelOf(t, gw))
	require.Equal(t, str("active-1"), id)

	// A deleted config is absent from the snapshot entirely.
	_, _, err = f.GetGatewayByConfigID("deleted-1")
	require.Error(t, err)
	require.True(t, errors.Is(err, exceptions.ErrUnsupportedGateway))
}

func TestReplaceDropsPreviousEntries(t *testing.T) {
	f := NewGatewayFactory()
	f.Replace([]ConfigEntry{entry("old", "xendit", "old", str("b1"), nil, true)})
	f.Replace([]ConfigEntry{entry("", "xendit", "env", nil, nil, true)})
	_, _, err := f.GetGatewayByConfigID("old")
	require.Error(t, err)
	require.True(t, f.HasSnapshot())
	require.False(t, NewGatewayFactory().HasSnapshot())
}

// Resolve must never observe a half-built state while Replace swaps snapshots:
// every call has to succeed with one of the two complete generations.
func TestResolveDuringReplaceNeverFails(t *testing.T) {
	genA := []ConfigEntry{
		entry("", "xendit", "A", nil, nil, true),
		entry("a-prog", "xendit", "A-prog", nil, str("p1"), true),
	}
	genB := []ConfigEntry{
		entry("", "xendit", "B", nil, nil, true),
		entry("b-prog", "xendit", "B-prog", nil, str("p1"), true),
	}
	f := NewGatewayFactory()
	f.Replace(genA)

	var wg sync.WaitGroup
	stop := make(chan struct{})
	errs := make(chan error, 8)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				if _, _, err := f.Resolve("xendit", "p1", "b1"); err != nil {
					errs <- err
					return
				}
				if _, err := f.GetGateway("xendit"); err != nil {
					errs <- err
					return
				}
			}
		}()
	}
	for i := 0; i < 2000; i++ {
		if i%2 == 0 {
			f.Replace(genB)
		} else {
			f.Replace(genA)
		}
	}
	close(stop)
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("resolve failed during replace: %v", err)
	}
}
