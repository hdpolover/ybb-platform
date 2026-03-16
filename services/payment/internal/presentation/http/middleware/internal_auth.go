package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func RequireInternalServiceKey(expectedKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.TrimSpace(expectedKey) == "" {
			c.Next()
			return
		}

		if c.GetHeader("X-Internal-Service-Key") != expectedKey {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid internal service key"})
			return
		}

		c.Next()
	}
}
