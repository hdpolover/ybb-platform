package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireInternalServiceKey_RejectsMissingHeader(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireInternalServiceKey("secret-key"))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestRequireInternalServiceKey_AllowsMatchingHeader(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireInternalServiceKey("secret-key"))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("X-Internal-Service-Key", "secret-key")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
}

// A blank configured key cannot authenticate anyone, so the guarded routes must
// stay closed rather than let every caller through.
func TestRequireInternalServiceKey_RejectsWhenKeyNotConfigured(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireInternalServiceKey("   "))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("X-Internal-Service-Key", "anything")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

// The comparison used to be `!=` on the raw strings, which short-circuits at the
// first differing byte — a byte-at-a-time oracle on a header an attacker can
// retry freely. These pin the behaviour, not the timing (timing is not
// meaningfully assertable in a unit test); the constant-time property is in the
// implementation.
func TestRequireInternalServiceKey_RejectsWrongAndPrefixKeys(t *testing.T) {
	const key = "a-real-looking-internal-key"

	for _, presented := range []string{"", "wrong", key[:len(key)-1], key + "x"} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/", nil)
		if presented != "" {
			c.Request.Header.Set("X-Internal-Service-Key", presented)
		}

		RequireInternalServiceKey(key)(c)

		if w.Code != 401 {
			t.Fatalf("presented %q: expected 401, got %d", presented, w.Code)
		}
	}
}

func TestRequireInternalServiceKey_AcceptsExactKey(t *testing.T) {
	const key = "a-real-looking-internal-key"

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("X-Internal-Service-Key", key)

	RequireInternalServiceKey(key)(c)

	if c.IsAborted() {
		t.Fatalf("expected the exact key to pass, got %d", w.Code)
	}
}
