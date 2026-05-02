package vocabulary

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestListRecordsInvalidPage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(NewService(nil))
	router := gin.New()
	router.GET("/vocab/records", handler.ListRecords)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/vocab/records?page=abc", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "INVALID_QUERY") {
		t.Fatalf("body = %s, want INVALID_QUERY", rec.Body.String())
	}
}
