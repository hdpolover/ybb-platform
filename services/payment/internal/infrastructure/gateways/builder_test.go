// services/payment/internal/infrastructure/gateways/builder_test.go
package gateways

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
)

func TestBuildGatewayByProvider(t *testing.T) {
	for _, p := range []string{"midtrans", "xendit", "stripe"} {
		gw, err := BuildGateway(p, "sk", "ck", "wh", "sandbox")
		require.NoError(t, err, p)
		require.Equal(t, p, gw.GetName())
	}
	_, err := BuildGateway("nope", "sk", "ck", "wh", "sandbox")
	require.Error(t, err)
}

func TestBuildEntriesOrderingAndSkips(t *testing.T) {
	brand := "b1"
	var warnings []string
	warnf := func(f string, a ...any) { warnings = append(warnings, fmt.Sprintf(f, a...)) }

	entries := BuildEntries(
		[]EnvCredentials{{Provider: "xendit", ServerKey: "env-sk", WebhookSecret: "env-wh"}},
		[]entities.GatewayConfig{
			{ID: "g1", Provider: "xendit", ServerKey: "sk", ClientKey: "ck", WebhookSecret: "wh", IsActive: true},
			{ID: "b1cfg", Provider: "xendit", BrandID: &brand, ServerKey: "sk", ClientKey: "ck", WebhookSecret: "wh", IsActive: false},
			{ID: "bad", Provider: "carrierpigeon", ServerKey: "sk", ClientKey: "ck", IsActive: true},
		},
		warnf,
	)

	// manual, env xendit, db global, db brand (inactive kept for by-id lookup); unknown provider skipped.
	require.Len(t, entries, 4)
	require.Equal(t, "manual", entries[0].Provider)
	require.Equal(t, "", entries[1].ID, "env entries are virtual: no id")
	require.Equal(t, "g1", entries[2].ID, "db global comes after env so it wins")
	require.Equal(t, "b1cfg", entries[3].ID)
	require.False(t, entries[3].IsActive)
	require.Len(t, warnings, 1)

	f := NewGatewayFactory()
	f.Replace(entries)
	_, id, err := f.Resolve("xendit", "", "b1")
	require.NoError(t, err)
	require.Nil(t, id, "inactive brand config must not be resolved")
}
