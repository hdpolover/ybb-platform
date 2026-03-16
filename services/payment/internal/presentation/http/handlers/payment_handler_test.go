package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
)

func TestGetPaymentReturnsTransaction(t *testing.T) {
	gin.SetMode(gin.TestMode)

	txRepo := &stubTransactionRepository{
		byID: map[string]*entities.PaymentTransaction{
			"tx-1": {
				ID:                 "tx-1",
				IntentID:           "intent-1",
				PaymentMethodID:    "bank_bca",
				GatewayReferenceID: "gw-1",
				Currency:           "IDR",
				AmountTotal:        150000,
				AmountSubtotal:     150000,
				NetAmount:          150000,
				Status:             entities.TransactionStatusPending,
				CreatedAt:          time.Unix(100, 0),
				UpdatedAt:          time.Unix(200, 0),
			},
		},
	}
	handler := NewPaymentHandler(&stubIntentRepository{}, txRepo, messaging.NewNoOpPublisher(), nil)

	router := gin.New()
	router.GET("/payments/:id", handler.GetPayment)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/payments/tx-1", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, "transaction", body["type"])
	require.Equal(t, "tx-1", body["id"])
	require.Equal(t, "intent-1", body["intent_id"])
}

func TestGetPaymentsByUserReturnsIntentList(t *testing.T) {
	gin.SetMode(gin.TestMode)

	intent := &entities.PaymentIntent{
		ID:            "intent-1",
		UserID:        "user-1",
		ReferenceType: "application",
		ReferenceID:   "app-1",
		Amount:        150000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusProcessing,
		Metadata:      json.RawMessage(`{"program":"YBB 2026"}`),
		CreatedAt:     time.Unix(100, 0),
		UpdatedAt:     time.Unix(200, 0),
	}
	tx := &entities.PaymentTransaction{
		ID:              "tx-1",
		IntentID:        intent.ID,
		PaymentMethodID: "bank_bca",
		Currency:        "IDR",
		AmountTotal:     150000,
		AmountSubtotal:  150000,
		NetAmount:       150000,
		Status:          entities.TransactionStatusPending,
		CreatedAt:       time.Unix(100, 0),
		UpdatedAt:       time.Unix(200, 0),
	}

	intentRepo := &stubIntentRepository{findAllResult: []*entities.PaymentIntent{intent}, total: 1}
	txRepo := &stubTransactionRepository{byIntentID: map[string][]*entities.PaymentTransaction{intent.ID: {tx}}}
	handler := NewPaymentHandler(intentRepo, txRepo, messaging.NewNoOpPublisher(), nil)

	router := gin.New()
	router.GET("/payments/user/:userId", handler.GetPaymentsByUser)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/payments/user/user-1?limit=5&offset=0", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Payments   []map[string]interface{} `json:"payments"`
		Pagination map[string]interface{}   `json:"pagination"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Payments, 1)
	require.Equal(t, "intent", body.Payments[0]["type"])
	require.Equal(t, float64(1), body.Pagination["total"])
	require.Equal(t, 5, intentRepo.lastFilter.Limit)
	require.Equal(t, 1, intentRepo.lastFilter.Page)
	require.Equal(t, "user-1", intentRepo.lastFilter.UserID)
}

func TestUploadProofUpdatesTransaction(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tx := &entities.PaymentTransaction{
		ID:              "tx-1",
		IntentID:        "intent-1",
		PaymentMethodID: "manual_transfer",
		Currency:        "IDR",
		AmountTotal:     100000,
		AmountSubtotal:  100000,
		NetAmount:       100000,
		Status:          entities.TransactionStatusPending,
		CreatedAt:       time.Unix(100, 0),
		UpdatedAt:       time.Unix(200, 0),
	}
	txRepo := &stubTransactionRepository{byID: map[string]*entities.PaymentTransaction{"tx-1": tx}}
	handler := NewPaymentHandler(&stubIntentRepository{}, txRepo, messaging.NewNoOpPublisher(), nil)

	router := gin.New()
	router.POST("/payments/:id/proof", handler.UploadProof)

	body := bytes.NewBufferString(`{"file_id":"file-1","file_url":"https://files/proof.jpg"}`)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/payments/tx-1/proof", body)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusNeedsReview, txRepo.updated.Status)
	require.Equal(t, "https://files/proof.jpg", txRepo.updated.ProofFileURL)
}

func TestVerifyPaymentApproveUpdatesTransactionAndIntent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	intent := &entities.PaymentIntent{
		ID:            "intent-1",
		UserID:        "user-1",
		ReferenceType: "application",
		ReferenceID:   "app-1",
		Amount:        100000,
		Currency:      "IDR",
		Status:        entities.PaymentIntentStatusProcessing,
		CreatedAt:     time.Unix(100, 0),
		UpdatedAt:     time.Unix(200, 0),
	}
	tx := &entities.PaymentTransaction{
		ID:              "tx-1",
		IntentID:        intent.ID,
		PaymentMethodID: "manual_transfer",
		Currency:        "IDR",
		AmountTotal:     100000,
		AmountSubtotal:  100000,
		NetAmount:       100000,
		Status:          entities.TransactionStatusNeedsReview,
		CreatedAt:       time.Unix(100, 0),
		UpdatedAt:       time.Unix(200, 0),
	}

	intentRepo := &stubIntentRepository{byID: map[string]*entities.PaymentIntent{intent.ID: intent}}
	txRepo := &stubTransactionRepository{byID: map[string]*entities.PaymentTransaction{tx.ID: tx}}
	handler := NewPaymentHandler(intentRepo, txRepo, messaging.NewNoOpPublisher(), nil)

	router := gin.New()
	router.POST("/payments/:id/verify", handler.VerifyPayment)

	body := bytes.NewBufferString(`{"action":"approve","admin_id":"admin-1"}`)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/payments/tx-1/verify", body)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, entities.TransactionStatusSuccess, txRepo.updated.Status)
	require.Equal(t, entities.PaymentIntentStatusSucceeded, intentRepo.updated.Status)
	require.NotNil(t, txRepo.updated.ReviewedBy)
	require.Equal(t, "admin-1", *txRepo.updated.ReviewedBy)
}

func TestGetPaymentsByUserRejectsInvalidLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewPaymentHandler(&stubIntentRepository{}, &stubTransactionRepository{}, messaging.NewNoOpPublisher(), nil)
	router := gin.New()
	router.GET("/payments/user/:userId", handler.GetPaymentsByUser)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/payments/user/user-1?limit=bad", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

type stubIntentRepository struct {
	byID          map[string]*entities.PaymentIntent
	findAllResult []*entities.PaymentIntent
	total         int64
	updated       *entities.PaymentIntent
	lastFilter    repositories.PaymentIntentFilter
}

func (s *stubIntentRepository) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	if s.byID == nil {
		s.byID = map[string]*entities.PaymentIntent{}
	}
	s.byID[intent.ID] = intent
	return nil
}

func (s *stubIntentRepository) FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error) {
	if intent, ok := s.byID[id]; ok {
		return intent, nil
	}
	return nil, errors.New("not found")
}

func (s *stubIntentRepository) FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error) {
	return nil, nil
}

func (s *stubIntentRepository) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	s.updated = intent
	if s.byID == nil {
		s.byID = map[string]*entities.PaymentIntent{}
	}
	s.byID[intent.ID] = intent
	return nil
}

func (s *stubIntentRepository) FindAll(ctx context.Context, filter repositories.PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error) {
	s.lastFilter = filter
	return s.findAllResult, s.total, nil
}

type stubTransactionRepository struct {
	byID       map[string]*entities.PaymentTransaction
	byIntentID map[string][]*entities.PaymentTransaction
	byGateway  map[string]*entities.PaymentTransaction
	updated    *entities.PaymentTransaction
}

func (s *stubTransactionRepository) Create(ctx context.Context, tx *entities.PaymentTransaction) error {
	if s.byID == nil {
		s.byID = map[string]*entities.PaymentTransaction{}
	}
	s.byID[tx.ID] = tx
	return nil
}

func (s *stubTransactionRepository) FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error) {
	if tx, ok := s.byID[id]; ok {
		return tx, nil
	}
	return nil, errors.New("not found")
}

func (s *stubTransactionRepository) Update(ctx context.Context, tx *entities.PaymentTransaction) error {
	s.updated = tx
	if s.byID == nil {
		s.byID = map[string]*entities.PaymentTransaction{}
	}
	s.byID[tx.ID] = tx
	return nil
}

func (s *stubTransactionRepository) FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error) {
	if txs, ok := s.byIntentID[intentID]; ok {
		return txs, nil
	}
	return nil, nil
}

func (s *stubTransactionRepository) FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error) {
	if tx, ok := s.byGateway[refID]; ok {
		return tx, nil
	}
	return nil, errors.New("not found")
}
