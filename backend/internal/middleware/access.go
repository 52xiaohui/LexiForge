package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/config"
	"lexiforge/backend/internal/httpx"
)

// AccessToken protects the single-user API without pretending the MVP has a
// multi-user authentication system. Development remains open when no token is
// configured; production config validation requires a strong token.
func AccessToken(cfg config.Config) gin.HandlerFunc {
	expected := []byte(cfg.AppAccessToken)
	return func(c *gin.Context) {
		if len(expected) == 0 || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		provided := bearerToken(c.GetHeader("Authorization"))
		if len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(provided), expected) != 1 {
			c.Header("WWW-Authenticate", `Bearer realm="LexiForge"`)
			httpx.Respond(c, http.StatusUnauthorized, "ACCESS_TOKEN_REQUIRED", "A valid LexiForge access token is required.", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}

func bearerToken(header string) string {
	scheme, token, ok := strings.Cut(strings.TrimSpace(header), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}
