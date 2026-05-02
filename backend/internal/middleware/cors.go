package middleware

import (
	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/config"
)

// CORS returns a Gin middleware whose allowlist depends on env.
//
// Dev: allow Vite (5173) and CRA (3000) on localhost.
// Production: closed by default — wire a strict allowlist when frontend lands.
func CORS(cfg config.Config) gin.HandlerFunc {
	allowed := map[string]struct{}{
		"http://localhost:5173": {},
		"http://localhost:3000": {},
		"http://127.0.0.1:5173": {},
		"http://127.0.0.1:3000": {},
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
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
