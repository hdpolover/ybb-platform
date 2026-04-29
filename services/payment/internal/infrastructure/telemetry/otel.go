package telemetry

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

const serviceName = "ybb-payment"

// InitTracer initializes an OTLP exporter, and configures the corresponding trace and metric providers.
func InitTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	endpoint := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if endpoint == "" {
		tp := sdktrace.NewTracerProvider(sdktrace.WithResource(res))
		applyGlobalTelemetry(tp)
		return tp, nil
	}

	endpoint = normalizeOTLPEndpoint(endpoint)
	if err := ensureEndpointResolvable(endpoint); err != nil {
		return nil, fmt.Errorf("OTEL_EXPORTER_OTLP_ENDPOINT %q is not resolvable: %w", endpoint, err)
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	applyGlobalTelemetry(tp)
	return tp, nil
}

func InitNoopTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(sdktrace.WithResource(res))
	applyGlobalTelemetry(tp)
	return tp, nil
}

func applyGlobalTelemetry(tp *sdktrace.TracerProvider) {
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
}

func normalizeOTLPEndpoint(endpoint string) string {
	endpoint = strings.TrimPrefix(endpoint, "http://")
	endpoint = strings.TrimPrefix(endpoint, "https://")
	return strings.TrimSuffix(endpoint, "/")
}

func ensureEndpointResolvable(endpoint string) error {
	host := endpoint
	if h, _, err := net.SplitHostPort(endpoint); err == nil {
		host = h
	}
	if host == "" {
		return fmt.Errorf("missing host")
	}
	_, err := net.LookupHost(host)
	return err
}
