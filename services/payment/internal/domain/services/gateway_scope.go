// services/payment/internal/domain/services/gateway_scope.go
package services

import (
	"encoding/json"
	"strings"
)

// GatewayScopeFromMetadata reads the program_id / brand_id an intent carries in
// its metadata; they pick which scoped gateway config charges it. Missing,
// non-string or unparsable values come back empty (global gateway).
func GatewayScopeFromMetadata(raw json.RawMessage) (programID, brandID string) {
	if len(raw) == 0 {
		return "", ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", ""
	}
	programID, _ = m["program_id"].(string)
	brandID, _ = m["brand_id"].(string)
	return strings.TrimSpace(programID), strings.TrimSpace(brandID)
}
