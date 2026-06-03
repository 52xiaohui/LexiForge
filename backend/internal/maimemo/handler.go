// Package maimemo wires the MaiMemo sync feature: REST endpoints, the
// service that reads/writes study_records, and the upstream HTTP client.
package maimemo

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

// Handler exposes MVP sync endpoints. Endpoints not in MVP (sync_jobs,
// integrations/maimemo/token) are intentionally absent.
type Handler struct {
	svc *Service
}

// NewHandler is the canonical constructor.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register attaches MVP sync routes to the given /api/v1 group.
func (h *Handler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/sync")
	g.POST("/maimemo", h.SyncMaimemo)
	g.GET("/latest", h.LatestSync)
}

// SyncMaimemo handles `POST /api/v1/sync/maimemo`.
func (h *Handler) SyncMaimemo(c *gin.Context) {
	result, err := h.svc.Sync(c.Request.Context())
	if err != nil {
		respondSyncError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// LatestSync handles `GET /api/v1/sync/latest`.
func (h *Handler) LatestSync(c *gin.Context) {
	latest, err := h.svc.LatestSync()
	if err != nil {
		httpx.Respond(c, http.StatusInternalServerError, "SYNC_LATEST_FAILED", "failed to read latest sync state", nil)
		return
	}
	c.JSON(http.StatusOK, latest)
}

// NewModule wires the maimemo Client + repo + service + handler.
func NewModule(db *gorm.DB, client Client, token string) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo, client, token)
	return NewHandler(svc)
}

func respondSyncError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrTokenMissing):
		httpx.Respond(c, http.StatusBadRequest, "MAIMEMO_TOKEN_MISSING", "MAIMEMO_TOKEN is not configured.", nil)
	case errors.Is(err, ErrInvalidToken):
		httpx.Respond(c, http.StatusUnauthorized, "MAIMEMO_TOKEN_INVALID", "墨墨 Token 无效或已过期，请重新配置。", nil)
	case errors.Is(err, ErrUnavailable):
		httpx.Respond(c, http.StatusBadGateway, "MAIMEMO_API_UNAVAILABLE", "暂时无法连接墨墨开放 API，请稍后重试。", nil)
	default:
		slog.Error("maimemo sync failed", "error", err)
		httpx.Respond(c, http.StatusInternalServerError, "MAIMEMO_SYNC_FAILED", "failed to sync MaiMemo records", nil)
	}
}
