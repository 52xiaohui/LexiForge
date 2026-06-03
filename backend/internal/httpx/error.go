// Package httpx provides shared HTTP response helpers — the single place where
// the {code, message, details} error envelope from docs/04-api.md is shaped.
//
// Every handler must funnel error responses through Respond so error codes stay
// consistent and pass through to the frontend.
package httpx

import "github.com/gin-gonic/gin"

// ErrorResponse is the wire format for all non-2xx JSON responses.
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

// Respond writes status + JSON error envelope. `details` may be nil.
func Respond(c *gin.Context, status int, code, message string, details any) {
	c.AbortWithStatusJSON(status, ErrorResponse{
		Code:    code,
		Message: message,
		Details: details,
	})
}
