// internal/presentation/http/handlers/payment_handler_scope_test.go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	infraGateways "github.com/ybb-platform/payment/internal/infrastructure/gateways"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
)

const scopedCfgID = "11111111-1111-1111-1111-111111111111"

type scopeFixture struct {
	handler   *PaymentHandler
	txRepo    *stubTransactionRepository
	intent    *stubIntentRepository
	tx        *entities.PaymentTransaction
	router    *gin.Engine
	globalGW  *stubPaymentGateway
	scopedGW  *stubPaymentGateway
	scopedCfg infraGateways.ConfigEntry
	factory   *infraGateways.GatewayFactory
}

// setScopedState re-snapshots the factory with the scoped config's activity changed.
func (f *scopeFixture) setScopedState(active bool, deactivatedAt *time.Time) {
	e := f.scopedCfg
	e.IsActive, e.DeactivatedAt = active, deactivatedAt
	f.factory.Replace([]infraGateways.ConfigEntry{
		{Provider: "xendit", IsActive: true, Gateway: f.globalGW},
		e,
	})
}

func ago(d time.Duration) *time.Time { t := time.Now().Add(-d); return &t }

// newScopeFixture wires a global xendit stub plus a program-scoped xendit stub
// registered under scopedCfgID, and a pending tx pinned to pin (nil = global).
func newScopeFixture(pin *string) *scopeFixture {
	gin.SetMode(gin.TestMode)
	settled := &entities.Payment{ID: "order-1", GatewayOrderID: "order-1", Status: entities.PaymentStatusSuccess}
	globalGW := &stubPaymentGateway{name: "xendit", webhookPayment: settled}
	scopedGW := &stubPaymentGateway{name: "xendit", webhookPayment: settled}

	factory := infraGateways.NewGatewayFactory()
	prog := "prog-1"
	scopedCfg := infraGateways.ConfigEntry{ID: scopedCfgID, Provider: "xendit", ProgramID: &prog, IsActive: true, Gateway: scopedGW}
	factory.Replace([]infraGateways.ConfigEntry{
		{Provider: "xendit", IsActive: true, Gateway: globalGW},
		scopedCfg,
		{ID: "22222222-2222-2222-2222-222222222222", Provider: "midtrans", IsActive: true, Gateway: &stubPaymentGateway{name: "midtrans"}},
	})

	intent := &entities.PaymentIntent{ID: "intent-1", Amount: 100000, Currency: "IDR", Status: entities.PaymentIntentStatusProcessing, Metadata: json.RawMessage(`{}`)}
	tx := &entities.PaymentTransaction{
		ID: "tx-1", IntentID: intent.ID, GatewayReferenceID: "order-1", PaymentMethodID: "xendit_va",
		GatewayResponse: json.RawMessage(`{"provider":"xendit","token":"inv-1"}`),
		Currency:        "IDR", AmountTotal: 100000, Status: entities.TransactionStatusPending,
		GatewayConfigID: pin, CreatedAt: time.Unix(100, 0), UpdatedAt: time.Unix(200, 0),
	}
	intentRepo := &stubIntentRepository{byID: map[string]*entities.PaymentIntent{intent.ID: intent}}
	txRepo := &stubTransactionRepository{
		byID:      map[string]*entities.PaymentTransaction{tx.ID: tx},
		byGateway: map[string]*entities.PaymentTransaction{"order-1": tx},
	}
	h := NewPaymentHandler(intentRepo, txRepo, messaging.NewNoOpPublisher(), factory)

	r := gin.New()
	r.POST("/payments/webhook/:gateway", h.HandleWebhook)
	r.POST("/payments/webhook/:gateway/:configId", h.HandleWebhook)
	r.POST("/payments/:id/cancel", h.CancelPayment)
	return &scopeFixture{handler: h, txRepo: txRepo, intent: intentRepo, tx: tx, router: r, globalGW: globalGW, scopedGW: scopedGW, scopedCfg: scopedCfg, factory: factory}
}

func (f *scopeFixture) post(path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(`{"reason":"x"}`)))
	return rec
}

func pinTo(id string) *string { return &id }

func TestScopedWebhookSettlesPinnedTransaction(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotNil(t, f.txRepo.updated)
	require.Equal(t, entities.TransactionStatusSuccess, f.txRepo.updated.Status)
}

func TestScopedWebhookRejectsGlobalTransaction(t *testing.T) {
	f := newScopeFixture(nil)
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Nil(t, f.txRepo.updated)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

func TestLegacyWebhookRejectsPinnedTransaction(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	rec := f.post("/payments/webhook/xendit")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Nil(t, f.txRepo.updated)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

func TestScopedWebhookRejectsTransactionPinnedToOtherConfig(t *testing.T) {
	f := newScopeFixture(pinTo("33333333-3333-3333-3333-333333333333"))
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Nil(t, f.txRepo.updated)
}

func TestScopedWebhookUnknownConfigIs404(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	rec := f.post("/payments/webhook/xendit/99999999-9999-9999-9999-999999999999")
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Nil(t, f.txRepo.updated)
}

func TestScopedWebhookProviderMismatchIs400(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	rec := f.post("/payments/webhook/midtrans/" + scopedCfgID)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Nil(t, f.txRepo.updated)
}

// The scoped route must verify with THAT config's secret, not the global one.
func TestScopedWebhookWrongCallbackTokenRejected(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	factory := infraGateways.NewGatewayFactory()
	factory.Replace([]infraGateways.ConfigEntry{
		{Provider: "xendit", IsActive: true, Gateway: infraGateways.NewXenditGateway("k", "global-token")},
		{ID: scopedCfgID, Provider: "xendit", ProgramID: pinTo("prog-1"), IsActive: true, Gateway: infraGateways.NewXenditGateway("k", "scoped-token")},
	})
	h := NewPaymentHandler(f.intent, f.txRepo, messaging.NewNoOpPublisher(), factory)
	r := gin.New()
	r.POST("/payments/webhook/:gateway/:configId", h.HandleWebhook)

	send := func(token string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/payments/webhook/xendit/"+scopedCfgID,
			bytes.NewBufferString(`{"id":"order-1","external_id":"order-1","status":"PAID","amount":100000,"currency":"IDR"}`))
		req.Header.Set("x-callback-token", token)
		r.ServeHTTP(rec, req)
		return rec
	}

	require.Equal(t, http.StatusBadRequest, send("global-token").Code)
	require.Nil(t, f.txRepo.updated)
	require.Equal(t, http.StatusOK, send("scoped-token").Code)
	require.Equal(t, entities.TransactionStatusSuccess, f.txRepo.updated.Status)
}

func TestCancelPinnedTransactionUsesPinnedGateway(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	// Global would fail the cancel; only the pinned gateway succeeds.
	f.globalGW.cancelErr = http500()
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusVoid, f.tx.Status)
}

func TestCancelPinnedTransactionWithMissingConfigIs502(t *testing.T) {
	f := newScopeFixture(pinTo("44444444-4444-4444-4444-444444444444"))
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

// A 404 from the GLOBAL gateway means nothing for a pinned tx: only the pinned
// config's own answer may decide to void. Here the pinned gateway fails
// transiently and still reports the invoice pending, so nothing may be voided.
func TestCancelPinnedTransactionIgnoresGlobalGateway404(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.globalGW.cancelErr = errString("404 NOT_FOUND")
	f.scopedGW.cancelErr = errString("500 upstream down")
	f.scopedGW.verifyPayment = &entities.Payment{Status: entities.PaymentStatusPending}
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

// A pinned config whose provider differs from the transaction's is an error,
// never a fallback and never a void.
func TestCancelPinnedTransactionProviderMismatchLeavesPending(t *testing.T) {
	f := newScopeFixture(pinTo("22222222-2222-2222-2222-222222222222")) // a midtrans config, tx is xendit
	f.globalGW.cancelErr = errString("404 NOT_FOUND")
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

func TestCancelGlobalTransactionStillUsesGlobalGateway(t *testing.T) {
	f := newScopeFixture(nil)
	f.scopedGW.cancelErr = http500() // would fail if the scoped gateway were used
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusVoid, f.tx.Status)
}

func http500() error { return errString("500 internal") }

type errString string

func (e errString) Error() string { return string(e) }

func TestScopedWebhookInactiveWithinGraceAccepted(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.setScopedState(false, ago(webhookInactiveGrace-time.Hour))
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusSuccess, f.txRepo.updated.Status)
}

func TestScopedWebhookInactivePastGraceRejected(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.setScopedState(false, ago(webhookInactiveGrace+time.Hour))
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Nil(t, f.txRepo.updated)
	require.Equal(t, entities.TransactionStatusPending, f.tx.Status)
}

// Inactive with no recorded deactivation time predates tracking: not trusted.
func TestScopedWebhookInactiveWithoutTimestampRejected(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.setScopedState(false, nil)
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Nil(t, f.txRepo.updated)
}

// An active config is never subject to the grace window, whatever stale timestamp it carries.
func TestScopedWebhookActiveIgnoresDeactivatedAt(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.setScopedState(true, ago(10*webhookInactiveGrace))
	rec := f.post("/payments/webhook/xendit/" + scopedCfgID)
	require.Equal(t, http.StatusOK, rec.Code)
}

// Outbound calls are not gated by the webhook grace: a long-inactive pinned
// config must still be able to cancel its own pending transaction.
func TestCancelOnLongInactivePinnedConfigStillWorks(t *testing.T) {
	f := newScopeFixture(pinTo(scopedCfgID))
	f.setScopedState(false, ago(10*webhookInactiveGrace))
	f.globalGW.cancelErr = errString("500 would fail if global were used")
	rec := f.post("/payments/" + f.tx.ID + "/cancel")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusVoid, f.tx.Status)
}
