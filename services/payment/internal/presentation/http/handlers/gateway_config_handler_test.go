package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
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

// --- scope handling -------------------------------------------------------

type fakeGatewayConfigRepo struct {
	repositories.GatewayConfigRepository
	stored  *entities.GatewayConfig
	created *entities.GatewayConfig
	updated *entities.GatewayConfig
	deleted bool
	pending int64
}

func (r *fakeGatewayConfigRepo) FindByID(context.Context, string) (*entities.GatewayConfig, error) {
	if r.stored == nil {
		return nil, errors.New("not found")
	}
	cp := *r.stored
	return &cp, nil
}
func (r *fakeGatewayConfigRepo) Create(_ context.Context, c *entities.GatewayConfig) error {
	r.created = c
	return nil
}
func (r *fakeGatewayConfigRepo) Update(_ context.Context, c *entities.GatewayConfig) error {
	r.updated = c
	return nil
}
func (r *fakeGatewayConfigRepo) Delete(context.Context, string) error { r.deleted = true; return nil }
func (r *fakeGatewayConfigRepo) CountPendingTransactions(context.Context, string) (int64, error) {
	return r.pending, nil
}

type fakeMethodRepo struct {
	repositories.PaymentMethodRepository
	refs int64
}

func (r fakeMethodRepo) CountByGatewayName(context.Context, string) (int64, error) {
	return r.refs, nil
}

func doGatewayConfigReq(h gin.HandlerFunc, method, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, "/gateway-configs/cfg-1", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "cfg-1"}}
	h(c)
	return w
}

const validXenditBody = `"provider":"xendit","mode":"sandbox","server_key":"xnd_development_a","client_key":"x","webhook_secret":"t","is_active":true`
const (
	brandUUID   = "11111111-1111-1111-1111-111111111111"
	programUUID = "22222222-2222-2222-2222-222222222222"
)

func TestCreateRejectsBrandAndProgramTogether(t *testing.T) {
	repo := &fakeGatewayConfigRepo{}
	h := NewGatewayConfigHandler(repo, fakeMethodRepo{})
	body := `{` + validXenditBody + `,"brand_id":"` + brandUUID + `","program_id":"` + programUUID + `"}`
	w := doGatewayConfigReq(h.Create, http.MethodPost, body)
	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Nil(t, repo.created)
}

func TestCreateAcceptsSingleScopeAndNormalisesEmptyStrings(t *testing.T) {
	repo := &fakeGatewayConfigRepo{}
	h := NewGatewayConfigHandler(repo, fakeMethodRepo{})
	body := `{` + validXenditBody + `,"brand_id":"","program_id":"` + programUUID + `"}`
	w := doGatewayConfigReq(h.Create, http.MethodPost, body)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	require.Nil(t, repo.created.BrandID, "empty string must become NULL, not an invalid uuid")
	require.Equal(t, programUUID, *repo.created.ProgramID)
}

func TestCreateRejectsMalformedScopeID(t *testing.T) {
	h := NewGatewayConfigHandler(&fakeGatewayConfigRepo{}, fakeMethodRepo{})
	w := doGatewayConfigReq(h.Create, http.MethodPost, `{`+validXenditBody+`,"program_id":"not-a-uuid"}`)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateKeepsScopeWhenOmittedAndRejectsScopeChange(t *testing.T) {
	brand := brandUUID
	repo := &fakeGatewayConfigRepo{stored: &entities.GatewayConfig{ID: "cfg-1", BrandID: &brand, Provider: "xendit",
		Mode: "sandbox", ServerKey: "xnd_development_a", ClientKey: "x", WebhookSecret: "t"}}
	h := NewGatewayConfigHandler(repo, fakeMethodRepo{})

	// Scope omitted: a brand-scoped config must not silently become global.
	w := doGatewayConfigReq(h.Update, http.MethodPut, `{`+validXenditBody+`}`)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.Equal(t, brandUUID, *repo.updated.BrandID)
	require.Nil(t, repo.updated.ProgramID)

	// Moving it to a program is a different config; must be created fresh.
	repo.updated = nil
	w = doGatewayConfigReq(h.Update, http.MethodPut, `{`+validXenditBody+`,"program_id":"`+programUUID+`"}`)
	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Nil(t, repo.updated)
}

func TestDeleteGuardScopedBlocksOnlyOnPendingTransactions(t *testing.T) {
	prog := programUUID
	scoped := &entities.GatewayConfig{ID: "cfg-1", ProgramID: &prog, Provider: "xendit"}

	// Payment methods still reference the provider, but a scoped delete does not care.
	repo := &fakeGatewayConfigRepo{stored: scoped, pending: 2}
	h := NewGatewayConfigHandler(repo, fakeMethodRepo{refs: 5})
	w := doGatewayConfigReq(h.Delete, http.MethodDelete, "")
	require.Equal(t, http.StatusConflict, w.Code)
	require.False(t, repo.deleted)

	repo = &fakeGatewayConfigRepo{stored: scoped, pending: 0}
	h = NewGatewayConfigHandler(repo, fakeMethodRepo{refs: 5})
	w = doGatewayConfigReq(h.Delete, http.MethodDelete, "")
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	require.True(t, repo.deleted)
}

func TestDeleteGuardGlobalKeepsPaymentMethodGuard(t *testing.T) {
	repo := &fakeGatewayConfigRepo{stored: &entities.GatewayConfig{ID: "cfg-1", Provider: "xendit"}}
	h := NewGatewayConfigHandler(repo, fakeMethodRepo{refs: 1})
	w := doGatewayConfigReq(h.Delete, http.MethodDelete, "")
	require.Equal(t, http.StatusConflict, w.Code)
	require.False(t, repo.deleted)
}
