package article

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGenerateInvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(NewService(&fakeArticleRepo{}, &fakeAIClient{}))
	router := gin.New()
	router.POST("/articles/generate", handler.Generate)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/articles/generate", strings.NewReader("{"))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "INVALID_JSON") {
		t.Fatalf("body = %s, want INVALID_JSON", rec.Body.String())
	}
}
