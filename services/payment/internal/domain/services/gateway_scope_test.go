// services/payment/internal/domain/services/gateway_scope_test.go
package services

import "testing"

func TestGatewayScopeFromMetadata(t *testing.T) {
	tests := []struct {
		name, raw, wantProgram, wantBrand string
	}{
		{"both", `{"program_id":"p","brand_id":"b"}`, "p", "b"},
		{"program only", `{"program_id":" p "}`, "p", ""},
		{"non-string ignored", `{"program_id":5,"brand_id":null}`, "", ""},
		{"empty", ``, "", ""},
		{"invalid json", `{`, "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p, b := GatewayScopeFromMetadata([]byte(tc.raw))
			if p != tc.wantProgram || b != tc.wantBrand {
				t.Fatalf("got (%q,%q), want (%q,%q)", p, b, tc.wantProgram, tc.wantBrand)
			}
		})
	}
}
