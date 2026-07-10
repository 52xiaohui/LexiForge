package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestOperationRateLimitSeparatesGenerationAndSyncBudgets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	aiLimiter := newFixedWindowLimiter(2, time.Minute, clock)
	syncLimiter := newFixedWindowLimiter(1, time.Minute, clock)

	router := gin.New()
	router.Use(operationRateLimit(aiLimiter, syncLimiter))
	for _, path := range []string{
		"/api/v1/articles/generate",
		"/api/v1/articles/:id/regenerate",
		"/api/v1/sync/maimemo",
	} {
		router.POST(path, func(c *gin.Context) { c.Status(http.StatusNoContent) })
	}

	assertRequestStatus(t, router, http.MethodPost, "/api/v1/articles/generate", http.StatusNoContent)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/articles/abc/regenerate", http.StatusNoContent)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/articles/generate", http.StatusTooManyRequests)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/sync/maimemo", http.StatusNoContent)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/sync/maimemo", http.StatusTooManyRequests)

	now = now.Add(time.Minute)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/articles/generate", http.StatusNoContent)
	assertRequestStatus(t, router, http.MethodPost, "/api/v1/sync/maimemo", http.StatusNoContent)
}

func assertRequestStatus(t *testing.T, router http.Handler, method, path string, want int) {
	t.Helper()
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	if recorder.Code != want {
		t.Fatalf("%s %s status = %d, want %d; body=%s", method, path, recorder.Code, want, recorder.Body.String())
	}
	if want == http.StatusTooManyRequests && recorder.Header().Get("Retry-After") == "" {
		t.Fatalf("%s %s missing Retry-After header", method, path)
	}
}
