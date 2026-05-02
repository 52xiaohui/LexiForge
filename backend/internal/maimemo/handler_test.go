package maimemo

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSyncMaimemoMissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(NewService(&fakeSyncRepo{}, &fakeClient{}, ""))
	router := gin.New()
	router.POST("/sync/maimemo", handler.SyncMaimemo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/sync/maimemo", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if body := rec.Body.String(); body == "" || !strings.Contains(body, "MAIMEMO_TOKEN_MISSING") {
		t.Fatalf("body = %s, want MAIMEMO_TOKEN_MISSING", body)
	}
}
