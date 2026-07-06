package middleware

import (
	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/config"
)

// CORS returns a Gin middleware whose allowlist depends on config.
//
// Dev: allow Vite (5173) and CRA (3000) on localhost. Production is closed by
// default unless CORS_ALLOWED_ORIGINS is configured.
func CORS(cfg config.Config) gin.HandlerFunc {
	allowed := allowedOrigins(cfg)

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if allowed.allows(origin) {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
				c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,Accept")
			}
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

type corsAllowlist struct {
	allowAll bool
	origins  map[string]struct{}
}

func (allowlist corsAllowlist) allows(origin string) bool {
	if allowlist.allowAll {
		return true
	}
	_, ok := allowlist.origins[origin]
	return ok
}

func allowedOrigins(cfg config.Config) corsAllowlist {
	allowed := corsAllowlist{
		origins: make(map[string]struct{}),
	}
	if !cfg.IsProduction() {
		for _, origin := range []string{
			"http://localhost:5173",
			"http://localhost:3000",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:3000",
		} {
			allowed.origins[origin] = struct{}{}
		}
	}
	for _, origin := range cfg.CORSAllowedOrigins {
		if origin == "*" {
			allowed.allowAll = true
			continue
		}
		allowed.origins[origin] = struct{}{}
	}
	return allowed
}
