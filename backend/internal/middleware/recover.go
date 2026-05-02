package middleware

import (
	"log/slog"
	"runtime/debug"

	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/httpx"
)

// Recover catches handler panics and converts them into a 500
// INTERNAL_ERROR JSON response.
//
// Captures the stack via runtime/debug for the server log; clients only
// see the canonical envelope so panic detail never leaks.
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("panic recovered",
					"error", r,
					"path", c.Request.URL.Path,
					"stack", string(debug.Stack()),
				)
				if !c.Writer.Written() {
					httpx.Respond(c, 500, "INTERNAL_ERROR", "internal server error", nil)
				}
			}
		}()
		c.Next()
	}
}
