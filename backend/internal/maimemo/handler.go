// Package maimemo wires the MaiMemo sync feature: REST endpoints, the
// service that reads/writes study_records, and the upstream HTTP client.
package maimemo

import (
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

// SyncMaimemo stubs `POST /api/v1/sync/maimemo`.
//
// MVP semantics from docs/04-api.md: synchronous full-pull, returns counts.
// This stub will be replaced once the maimemo client lands.
func (h *Handler) SyncMaimemo(c *gin.Context) {
	httpx.NotImplemented(c, "POST /sync/maimemo")
}

// LatestSync stubs `GET /api/v1/sync/latest`.
func (h *Handler) LatestSync(c *gin.Context) {
	httpx.NotImplemented(c, "GET /sync/latest")
}

// NewModule wires the maimemo Client + repo + service + handler.
func NewModule(db *gorm.DB, client Client) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo, client)
	return NewHandler(svc)
}
