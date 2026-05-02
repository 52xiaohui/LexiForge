// Package middleware bundles Gin middleware: CORS, structured request logging
// with secret redaction, and panic recovery.
//
// MVP enforces: never log Authorization / token / known secret env-var names.
// docs/07-security.md spells out the redaction list — keep this in sync.
package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// redactedHeaders are HTTP request headers stripped from logs entirely.
var redactedHeaders = map[string]struct{}{
	"authorization": {},
	"cookie":        {},
	"x-api-key":     {},
}

// redactedQueryParams are URL query parameters whose values get masked in logs.
var redactedQueryParams = []string{"token", "api_key", "apikey", "access_token"}

// SafeHeader returns the header value or "***" if it is on the redact list.
//
// Loggers should call this instead of accessing c.GetHeader directly.
func SafeHeader(c *gin.Context, name string) string {
	if _, ok := redactedHeaders[strings.ToLower(name)]; ok {
		if c.GetHeader(name) == "" {
			return ""
		}
		return "***"
	}
	return c.GetHeader(name)
}

// MaskQueryString returns a redacted copy of a raw query string.
//
// Used by the logger middleware so URLs in logs never carry tokens.
func MaskQueryString(raw string) string {
	if raw == "" {
		return raw
	}
	parts := strings.Split(raw, "&")
	for i, p := range parts {
		eq := strings.IndexByte(p, '=')
		if eq <= 0 {
			continue
		}
		key := strings.ToLower(p[:eq])
		for _, secret := range redactedQueryParams {
			if key == secret {
				parts[i] = p[:eq] + "=***"
				break
			}
		}
	}
	return strings.Join(parts, "&")
}
