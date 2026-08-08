package grpc

import (
	"context"
	"errors"
	"strings"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/gateways"
	"github.com/ybb-platform/payment/internal/domain/repositories"
	pb "github.com/ybb-platform/payment/internal/infrastructure/grpc/proto"
	"github.com/ybb-platform/payment/internal/infrastructure/messaging"
)

// varcharGuardTxRepo/varcharGuardIntentRepo/varcharGuardIdempotencyRepo are
// minimal stubs for the varchar-length-guard tests below. Named distinctly
// from create_intent_test.go's stubIntentRepository since both live in
// package grpc.

type varcharGuardTxRepo struct {
	byID    map[string]*entities.PaymentTransaction
	updated *entities.PaymentTransaction
}

func (s *varcharGuardTxRepo) Create(ctx context.Context, tx *entities.PaymentTransaction) error {
	return nil
}
func (s *varcharGuardTxRepo) FindByID(ctx context.Context, id string) (*entities.PaymentTransaction, error) {
	if tx, ok := s.byID[id]; ok {
		return tx, nil
	}
	return nil, errors.New("not found")
}
func (s *varcharGuardTxRepo) Update(ctx context.Context, tx *entities.PaymentTransaction) error {
	s.updated = tx
	return nil
}
func (s *varcharGuardTxRepo) FindByIntentID(ctx context.Context, intentID string) ([]*entities.PaymentTransaction, error) {
	return nil, nil
}
func (s *varcharGuardTxRepo) FindByGatewayReferenceID(ctx context.Context, refID string) (*entities.PaymentTransaction, error) {
	return nil, errors.New("not found")
}

type varcharGuardIntentRepo struct {
	byID map[string]*entities.PaymentIntent
}

func (s *varcharGuardIntentRepo) Create(ctx context.Context, intent *entities.PaymentIntent) error {
	return nil
}
func (s *varcharGuardIntentRepo) FindByID(ctx context.Context, id string) (*entities.PaymentIntent, error) {
	if intent, ok := s.byID[id]; ok {
		return intent, nil
	}
	return nil, errors.New("not found")
}
func (s *varcharGuardIntentRepo) FindByReference(ctx context.Context, refType, refID string) ([]*entities.PaymentIntent, error) {
	return nil, nil
}
func (s *varcharGuardIntentRepo) FindOpenByReference(ctx context.Context, referenceType, referenceID string) (*entities.PaymentIntent, error) {
	return nil, nil
}
func (s *varcharGuardIntentRepo) Update(ctx context.Context, intent *entities.PaymentIntent) error {
	return nil
}
func (s *varcharGuardIntentRepo) FindAll(ctx context.Context, filter repositories.PaymentIntentFilter) ([]*entities.PaymentIntent, int64, error) {
	return nil, 0, nil
}

type varcharGuardIdempotencyRepo struct {
	createCalls  int
	findKeyCalls int
}

func (s *varcharGuardIdempotencyRepo) Create(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	s.createCalls++
	return nil
}
func (s *varcharGuardIdempotencyRepo) FindByKey(ctx context.Context, key, scope string) (*entities.PaymentIdempotencyKey, error) {
	s.findKeyCalls++
	return nil, nil
}
func (s *varcharGuardIdempotencyRepo) Update(ctx context.Context, record *entities.PaymentIdempotencyKey) error {
	return nil
}

// varcharGuardMethodRepo/varcharGuardGatewayFactory/varcharGuardGateway back
// the ProcessPayment gateway-failure test, which needs a resolvable,
// non-manual payment method wired to a gateway that returns a long error.

type varcharGuardMethodRepo struct {
	method *entities.PaymentMethodEntity
}

func (r *varcharGuardMethodRepo) FindAll(ctx context.Context) ([]entities.PaymentMethodEntity, error) {
	return nil, nil
}
func (r *varcharGuardMethodRepo) FindByCode(ctx context.Context, code string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *varcharGuardMethodRepo) FindByID(ctx context.Context, id string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *varcharGuardMethodRepo) FindByCodeOrID(ctx context.Context, value string) (*entities.PaymentMethodEntity, error) {
	return r.method, nil
}
func (r *varcharGuardMethodRepo) CountByGatewayName(ctx context.Context, gatewayName string) (int64, error) {
	return 0, nil
}
func (r *varcharGuardMethodRepo) Create(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	return nil
}
func (r *varcharGuardMethodRepo) Update(ctx context.Context, pm *entities.PaymentMethodEntity) error {
	return nil
}
func (r *varcharGuardMethodRepo) Delete(ctx context.Context, id string) error { return nil }

type varcharGuardGatewayFactory struct {
	gw gateways.PaymentGateway
}

func (f *varcharGuardGatewayFactory) GetGateway(name string) (gateways.PaymentGateway, error) {
	return f.gw, nil
}

type varcharGuardGateway struct {
	chargeErr error
}

func (g *varcharGuardGateway) GetName() string { return "stub" }
func (g *varcharGuardGateway) CreatePayment(ctx context.Context, req *gateways.CreatePaymentRequest) (*gateways.CreatePaymentResponse, error) {
	return nil, nil
}
func (g *varcharGuardGateway) ChargePayment(ctx context.Context, req *gateways.ChargePaymentRequest) (*gateways.ChargePaymentResponse, error) {
	if g.chargeErr != nil {
		return nil, g.chargeErr
	}
	return &gateways.ChargePaymentResponse{Status: "PENDING", GatewayReferenceID: "gw-ref"}, nil
}
func (g *varcharGuardGateway) VerifyPayment(ctx context.Context, gatewayOrderID string) (*entities.Payment, error) {
	return nil, nil
}
func (g *varcharGuardGateway) HandleWebhook(ctx context.Context, payload []byte) (*entities.Payment, error) {
	return nil, nil
}
func (g *varcharGuardGateway) CancelPayment(ctx context.Context, gatewayOrderID string) error {
	return nil
}
func (g *varcharGuardGateway) RefundPayment(ctx context.Context, gatewayOrderID string, amount float64) error {
	return nil
}

// TestVerifyManualPaymentRejectStoresReasonInAdminNotes proves the FAILED
// branch of VerifyManualPayment no longer concatenates the rejection reason
// into ErrorCode (varchar(50)). A real rejection reason such as "Bukti
// transfer tidak sesuai dengan nominal tagihan" (51 chars) plus the old
// "MANUAL_REJECTION: " prefix (18 chars) overflowed the column and 500'd.
// The fix keeps ErrorCode a fixed literal and moves the reason to the
// unbounded AdminNotes column, mirroring payment_handler.go's VerifyPayment.
func TestVerifyManualPaymentRejectStoresReasonInAdminNotes(t *testing.T) {
	t.Parallel()

	intent := &entities.PaymentIntent{ID: "intent-1", ReferenceID: "ref-1"}
	tx := &entities.PaymentTransaction{ID: "tx-1", IntentID: intent.ID, Status: entities.TransactionStatusNeedsReview}

	txRepo := &varcharGuardTxRepo{byID: map[string]*entities.PaymentTransaction{tx.ID: tx}}
	intentRepo := &varcharGuardIntentRepo{byID: map[string]*entities.PaymentIntent{intent.ID: intent}}

	srv := NewPaymentGrpcServer(intentRepo, txRepo, nil, nil, nil, messaging.NewNoOpPublisher(), "", nil)

	reason := "Bukti transfer tidak sesuai dengan nominal tagihan" // 51 chars
	_, err := srv.VerifyManualPayment(context.Background(), &pb.VerifyManualPaymentRequest{
		TransactionId: tx.ID,
		Status:        "FAILED",
		Reason:        reason,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if txRepo.updated == nil {
		t.Fatal("expected transaction to be updated")
	}
	if txRepo.updated.ErrorCode != "MANUAL_REJECTED" {
		t.Fatalf("expected fixed ErrorCode literal %q, got %q", "MANUAL_REJECTED", txRepo.updated.ErrorCode)
	}
	if len(txRepo.updated.ErrorCode) > 50 {
		t.Fatalf("ErrorCode exceeds payment_transactions.error_code varchar(50): %d chars", len(txRepo.updated.ErrorCode))
	}
	if txRepo.updated.AdminNotes != reason {
		t.Fatalf("expected AdminNotes to hold the full reason %q, got %q", reason, txRepo.updated.AdminNotes)
	}
}

// TestProcessPaymentGatewayFailureUsesFixedErrorCode proves the gRPC charge
// path stores a fixed, short ErrorCode on gateway failure instead of the raw
// (truncated-to-250-but-still-over-50) wrapped error string, and puts the
// descriptive error text in AdminNotes instead.
func TestProcessPaymentGatewayFailureUsesFixedErrorCode(t *testing.T) {
	t.Parallel()

	intent := &entities.PaymentIntent{ID: "intent-1", UserID: "user-1", ReferenceID: "ref-1", Amount: 100000, Currency: "IDR"}

	txRepo := &varcharGuardTxRepo{}
	intentRepo := &varcharGuardIntentRepo{byID: map[string]*entities.PaymentIntent{intent.ID: intent}}

	longErr := errors.New(strings.Repeat("gateway timeout connecting to upstream provider ", 6)) // > 250 chars
	gw := &varcharGuardGateway{chargeErr: longErr}
	factory := &varcharGuardGatewayFactory{gw: gw}

	methodRepo := &varcharGuardMethodRepo{
		method: &entities.PaymentMethodEntity{Code: "bank_bca", Type: entities.MethodTypeAutomatic, GatewayName: "stub"},
	}

	srv := NewPaymentGrpcServer(intentRepo, txRepo, methodRepo, nil, factory, messaging.NewNoOpPublisher(), "stub", nil)
	_, err := srv.ProcessPayment(context.Background(), &pb.ProcessPaymentRequest{
		IntentId:        intent.ID,
		PaymentMethodId: "bank_bca",
	})
	if err == nil {
		t.Fatal("expected error from gateway charge failure")
	}
	if txRepo.updated == nil {
		t.Fatal("expected transaction to be updated on gateway failure")
	}
	if txRepo.updated.ErrorCode != "GATEWAY_ERROR" {
		t.Fatalf("expected fixed ErrorCode %q, got %q", "GATEWAY_ERROR", txRepo.updated.ErrorCode)
	}
	if len(txRepo.updated.ErrorCode) > 50 {
		t.Fatalf("ErrorCode exceeds payment_transactions.error_code varchar(50): %d chars", len(txRepo.updated.ErrorCode))
	}
	if txRepo.updated.AdminNotes != longErr.Error() {
		t.Fatalf("expected AdminNotes to hold the full gateway error, got %q", txRepo.updated.AdminNotes)
	}
}

// TestProcessPaymentRejectsOversizedIdempotencyKey proves an Idempotency-Key
// gRPC metadata value over 255 chars (payment_idempotency_keys.idempotency_key
// is varchar(255)) is rejected with a clear InvalidArgument before it ever
// reaches idempotencyRepo.Create / the DB write.
func TestProcessPaymentRejectsOversizedIdempotencyKey(t *testing.T) {
	t.Parallel()

	idemRepo := &varcharGuardIdempotencyRepo{}
	srv := NewPaymentGrpcServer(nil, nil, nil, idemRepo, nil, messaging.NewNoOpPublisher(), "", nil)

	oversized := strings.Repeat("a", maxIdempotencyKeyLength+1)
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("idempotency-key", oversized))

	_, err := srv.ProcessPayment(ctx, &pb.ProcessPaymentRequest{IntentId: "intent-1"})
	if err == nil {
		t.Fatal("expected error for oversized idempotency key")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", err)
	}
	if idemRepo.createCalls != 0 {
		t.Fatalf("expected no idempotency record to be created, got %d create calls", idemRepo.createCalls)
	}
	if idemRepo.findKeyCalls != 0 {
		t.Fatalf("expected no idempotency lookup, got %d find calls", idemRepo.findKeyCalls)
	}
}

// TestProcessPaymentAcceptsIdempotencyKeyAtMaxLength is the boundary
// companion to the oversized-key test: exactly 255 chars must not be
// rejected by the new length guard.
func TestProcessPaymentAcceptsIdempotencyKeyAtMaxLength(t *testing.T) {
	t.Parallel()

	idemRepo := &varcharGuardIdempotencyRepo{}
	intentRepo := &varcharGuardIntentRepo{}
	txRepo := &varcharGuardTxRepo{}
	srv := NewPaymentGrpcServer(intentRepo, txRepo, nil, idemRepo, nil, messaging.NewNoOpPublisher(), "", nil)

	exactly255 := strings.Repeat("a", maxIdempotencyKeyLength)
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("idempotency-key", exactly255))

	_, err := srv.ProcessPayment(ctx, &pb.ProcessPaymentRequest{IntentId: "intent-1"})
	if err == nil {
		t.Fatal("expected an error (intent not found), but not from the length guard")
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.NotFound {
		t.Fatalf("expected NotFound (intent lookup fails past the length guard), got %v", err)
	}
	if idemRepo.findKeyCalls == 0 {
		t.Fatal("expected the idempotency lookup to proceed past the length guard")
	}
}
