package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger logs every request through slog with secret-redacted fields.
//
// Format: structured key/value, level=info on 2xx/3xx, level=warn on 4xx,
// level=error on 5xx. URLs are passed through MaskQueryString so token=...
// query params get scrubbed.
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		path := c.Request.URL.Path
		query := MaskQueryString(c.Request.URL.RawQuery)

		attrs := []any{
			"method", c.Request.Method,
			"path", path,
			"query", query,
			"status", status,
			"latency_ms", latency.Milliseconds(),
			"client_ip", c.ClientIP(),
			"authorization", SafeHeader(c, "Authorization"),
		}

		switch {
		case status >= 500:
			slog.Error("http_request", attrs...)
		case status >= 400:
			slog.Warn("http_request", attrs...)
		default:
			slog.Info("http_request", attrs...)
		}
	}
}
