package middleware

import (
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/config"
	"lexiforge/backend/internal/httpx"
)

type fixedWindowLimiter struct {
	mu          sync.Mutex
	limit       int
	window      time.Duration
	windowStart time.Time
	used        int
	now         func() time.Time
}

func newFixedWindowLimiter(limit int, window time.Duration, now func() time.Time) *fixedWindowLimiter {
	return &fixedWindowLimiter{limit: limit, window: window, now: now}
}

func (l *fixedWindowLimiter) allow() (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	if l.windowStart.IsZero() || now.Sub(l.windowStart) >= l.window {
		l.windowStart = now
		l.used = 0
	}
	if l.used >= l.limit {
		return false, maxDuration(0, l.window-now.Sub(l.windowStart))
	}
	l.used++
	return true, 0
}

// OperationRateLimit places a process-local cost ceiling around the two paid
// or externally constrained MVP operations. It intentionally runs after access
// token validation so unauthenticated traffic cannot consume the allowance.
func OperationRateLimit(cfg config.Config) gin.HandlerFunc {
	return operationRateLimit(
		newFixedWindowLimiter(cfg.AIRateLimitPerMin, time.Minute, time.Now),
		newFixedWindowLimiter(cfg.SyncRateLimitPerMin, time.Minute, time.Now),
	)
}

func operationRateLimit(aiLimiter, syncLimiter *fixedWindowLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost {
			c.Next()
			return
		}

		var limiter *fixedWindowLimiter
		path := c.Request.URL.Path
		switch {
		case path == "/api/v1/articles/generate":
			limiter = aiLimiter
		case strings.HasPrefix(path, "/api/v1/articles/") && strings.HasSuffix(path, "/regenerate"):
			limiter = aiLimiter
		case path == "/api/v1/sync/maimemo":
			limiter = syncLimiter
		default:
			c.Next()
			return
		}

		allowed, retryAfter := limiter.allow()
		if allowed {
			c.Next()
			return
		}
		seconds := int(math.Ceil(retryAfter.Seconds()))
		if seconds < 1 {
			seconds = 1
		}
		c.Header("Retry-After", strconv.Itoa(seconds))
		httpx.Respond(c, http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests. Please retry later.", map[string]any{
			"retry_after_seconds": seconds,
		})
		c.Abort()
	}
}

func maxDuration(a, b time.Duration) time.Duration {
	if a > b {
		return a
	}
	return b
}
