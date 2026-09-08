package middleware

import (
	"crypto/sha256"
	"crypto/subtle"
	"log"
	"strings"

	"github.com/gin-gonic/gin"
)

func RequireInternalServiceKey(expectedKey string) gin.HandlerFunc {
	expectedKey = strings.TrimSpace(expectedKey)

	// An unset key cannot authenticate anyone, so the guarded routes stay
	// closed rather than open. Logged once here (at route setup) instead of
	// per request so a misconfigured deployment is obvious in the boot log.
	if expectedKey == "" {
		log.Println("internal_service_key_missing: internal endpoints will reject all requests until INTERNAL_SERVICE_KEY is configured")
	}

	// Hashed once at setup so the per-request path does no work proportional to
	// the secret.
	expectedDigest := sha256.Sum256([]byte(expectedKey))

	return func(c *gin.Context) {
		if expectedKey == "" || !matchesKey(c.GetHeader("X-Internal-Service-Key"), expectedDigest) {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid internal service key"})
			return
		}

		c.Next()
	}
}

// matchesKey compares in constant time. `!=` on strings short-circuits at the
// first differing byte, which on a header an attacker can retry freely is a
// byte-at-a-time oracle for the key. Digests are compared rather than the raw
// values so that length is covered by the same fixed-size comparison instead of
// leaking through an early length check.
func matchesKey(presented string, expectedDigest [32]byte) bool {
	presentedDigest := sha256.Sum256([]byte(presented))
	return subtle.ConstantTimeCompare(presentedDigest[:], expectedDigest[:]) == 1
}
