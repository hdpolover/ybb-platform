package grpc

import (
	"context"
	"strings"

	grpcCore "google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func InternalServiceKeyInterceptor(expectedKey string) grpcCore.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpcCore.UnaryServerInfo, handler grpcCore.UnaryHandler) (interface{}, error) {
		if strings.TrimSpace(expectedKey) == "" {
			return handler(ctx, req)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing request metadata")
		}

		for _, value := range md.Get("x-internal-service-key") {
			if value == expectedKey {
				return handler(ctx, req)
			}
		}

		return nil, status.Error(codes.Unauthenticated, "invalid internal service key")
	}
}
