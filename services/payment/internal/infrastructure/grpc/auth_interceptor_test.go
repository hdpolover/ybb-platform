package grpc

import (
	"context"
	"testing"

	grpcCore "google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestInternalServiceKeyInterceptor_RejectsMissingMetadata(t *testing.T) {
	t.Parallel()

	interceptor := InternalServiceKeyInterceptor("secret-key")
	_, err := interceptor(context.Background(), nil, &grpcCore.UnaryServerInfo{FullMethod: "/payment.PaymentService/ProcessPayment"}, func(ctx context.Context, req interface{}) (interface{}, error) {
		return "ok", nil
	})
	if err == nil {
		t.Fatal("expected unauthenticated error")
	}
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %s", status.Code(err))
	}
}

func TestInternalServiceKeyInterceptor_AllowsMatchingMetadata(t *testing.T) {
	t.Parallel()

	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-internal-service-key", "secret-key"))
	interceptor := InternalServiceKeyInterceptor("secret-key")
	resp, err := interceptor(ctx, nil, &grpcCore.UnaryServerInfo{FullMethod: "/payment.PaymentService/ProcessPayment"}, func(ctx context.Context, req interface{}) (interface{}, error) {
		return "ok", nil
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp != "ok" {
		t.Fatalf("expected ok response, got %v", resp)
	}
}
