package vocabulary

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

// Handler is the HTTP layer for vocabulary-related endpoints.
//
// MVP only registers stub routes that return 501; the real wiring lands
// once Service / Repository are implemented.
type Handler struct {
	svc *Service
}

// NewHandler builds a vocabulary handler from a *Service.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register attaches MVP vocab routes to the given /api/v1 router group.
func (h *Handler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/vocab")
	g.GET("/records", h.ListRecords)
	g.GET("/weak", h.ListWeak)
	g.GET("/summary", h.Summary)
	g.GET("/:id", h.GetByID)
}

// ListRecords stubs `GET /api/v1/vocab/records`.
func (h *Handler) ListRecords(c *gin.Context) {
	httpx.NotImplemented(c, "GET /vocab/records")
}

// ListWeak stubs `GET /api/v1/vocab/weak`.
func (h *Handler) ListWeak(c *gin.Context) {
	httpx.NotImplemented(c, "GET /vocab/weak")
}

// Summary stubs `GET /api/v1/vocab/summary`.
func (h *Handler) Summary(c *gin.Context) {
	httpx.NotImplemented(c, "GET /vocab/summary")
}

// GetByID stubs `GET /api/v1/vocab/:id`.
func (h *Handler) GetByID(c *gin.Context) {
	httpx.NotImplemented(c, "GET /vocab/:id")
}

// NewModule wires repository → service → handler with the given DB.
//
// main.go calls this once; tests can replace the repo with an in-memory fake.
func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo)
	return NewHandler(svc)
}
