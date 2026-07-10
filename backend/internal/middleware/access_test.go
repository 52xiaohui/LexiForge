package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"lexiforge/backend/internal/config"
)

func TestAccessTokenRejectsMissingAndAcceptsMatchingBearer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(AccessToken(config.Config{AppAccessToken: "0123456789abcdef0123456789abcdef"}))
	router.GET("/private", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/private", nil))
	if missing.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status = %d, want 401", missing.Code)
	}

	allowed := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer 0123456789abcdef0123456789abcdef")
	router.ServeHTTP(allowed, req)
	if allowed.Code != http.StatusOK {
		t.Fatalf("matching token status = %d, want 200; body=%s", allowed.Code, allowed.Body.String())
	}
}

func TestAccessTokenAllowsOpenDevelopmentAndPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name   string
		cfg    config.Config
		method string
	}{
		{name: "open development", cfg: config.Config{}, method: http.MethodGet},
		{name: "preflight", cfg: config.Config{AppAccessToken: "secret"}, method: http.MethodOptions},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(AccessToken(tc.cfg))
			router.Handle(tc.method, "/private", func(c *gin.Context) { c.Status(http.StatusNoContent) })
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(tc.method, "/private", nil))
			if recorder.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want 204", recorder.Code)
			}
		})
	}
}
