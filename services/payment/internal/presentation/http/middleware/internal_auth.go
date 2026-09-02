package middleware

import (
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

	return func(c *gin.Context) {
		if expectedKey == "" || c.GetHeader("X-Internal-Service-Key") != expectedKey {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid internal service key"})
			return
		}

		c.Next()
	}
}
