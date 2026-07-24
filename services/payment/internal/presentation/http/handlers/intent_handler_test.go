package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestValidateIdempotencyKey guards payment_idempotency_keys.idempotency_key
// (varchar(255)). A raw Idempotency-Key header/metadata value taken verbatim
// with no validation overflows the column as a Postgres "value too long" 500;
// this must instead be a clear 4xx, never silently truncated or hashed since
// that would change idempotency semantics for the caller.
func TestValidateIdempotencyKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		key     string
		wantErr bool
	}{
		{name: "empty key is allowed (idempotency is optional)", key: "", wantErr: false},
		{name: "typical key well under the limit", key: "order-2026-07-24-abc123", wantErr: false},
		{name: "exactly 255 chars is allowed", key: strings.Repeat("a", 255), wantErr: false},
		{name: "256 chars is rejected", key: strings.Repeat("a", 256), wantErr: true},
		{name: "grossly oversized key is rejected", key: strings.Repeat("a", 1000), wantErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := validateIdempotencyKey(tc.key)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// TestConfirmIntentRejectsOversizedIdempotencyKeyHeader proves the HTTP
// handler rejects an over-255-char Idempotency-Key header with a 400 before
// ever reaching the confirm-intent command handler (which is nil here; a
// panic would fail this test if validation were bypassed).
func TestConfirmIntentRejectsOversizedIdempotencyKeyHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewIntentHandler(nil, nil)
	router := gin.New()
	router.POST("/intents/:id/confirm", handler.ConfirmIntent)

	body := bytes.NewBufferString(`{"payment_method_id":"bank_bca"}`)
	req := httptest.NewRequest(http.MethodPost, "/intents/intent-1/confirm", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", strings.Repeat("a", 256))

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}
