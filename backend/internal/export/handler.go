// Package export hosts standalone export endpoints that don't fit cleanly
// inside the article or vocab packages.
//
// MVP only ships /articles/:id/export.md (registered by the article package).
// The /export/*.csv endpoints are v0.5+, so this package only carries the
// scaffolding for now.
package export

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Handler intentionally registers nothing in MVP — the only export endpoint
// (article markdown) lives next to its data, in the article package.
type Handler struct {
	svc *Service
}

// NewHandler is the canonical constructor.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register is a no-op in MVP; v0.5 will attach CSV/Anki routes here.
func (h *Handler) Register(_ *gin.RouterGroup) {}

// NewModule wires repo → service → handler.
func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo)
	return NewHandler(svc)
}
