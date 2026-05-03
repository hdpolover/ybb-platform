package config

import "testing"

func TestRequiresInternalServiceKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		environment string
		expected    bool
	}{
		{name: "empty", environment: "", expected: false},
		{name: "development", environment: "development", expected: false},
		{name: "dev", environment: "dev", expected: false},
		{name: "local", environment: "local", expected: false},
		{name: "test", environment: "test", expected: false},
		{name: "staging", environment: "staging", expected: true},
		{name: "production", environment: "production", expected: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if actual := requiresInternalServiceKey(tt.environment); actual != tt.expected {
				t.Fatalf("requiresInternalServiceKey(%q) = %v, expected %v", tt.environment, actual, tt.expected)
			}
		})
	}
}

func TestValidateInternalServiceKey(t *testing.T) {
	t.Parallel()

	if err := validateInternalServiceKey("production", ""); err == nil {
		t.Fatal("expected validation error for missing key in production")
	}

	if err := validateInternalServiceKey("staging", "   "); err == nil {
		t.Fatal("expected validation error for missing key in staging")
	}

	if err := validateInternalServiceKey("production", "payment-shared-key"); err != nil {
		t.Fatalf("expected valid key in production, got %v", err)
	}

	if err := validateInternalServiceKey("development", ""); err != nil {
		t.Fatalf("expected missing key to be allowed in development, got %v", err)
	}
}
