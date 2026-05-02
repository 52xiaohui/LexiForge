package article

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

// Handler covers MVP article endpoints — generate / list / get / delete /
// markdown export. All return 501 in the skeleton.
type Handler struct {
	svc *Service
}

// NewHandler is the canonical constructor.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register attaches MVP article routes to the given /api/v1 group.
func (h *Handler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/articles")
	g.POST("/generate", h.Generate)
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.DELETE("/:id", h.Delete)
	g.GET("/:id/export.md", h.ExportMarkdown)
}

// Generate stubs `POST /api/v1/articles/generate`.
func (h *Handler) Generate(c *gin.Context) {
	httpx.NotImplemented(c, "POST /articles/generate")
}

// List stubs `GET /api/v1/articles`.
func (h *Handler) List(c *gin.Context) {
	httpx.NotImplemented(c, "GET /articles")
}

// Get stubs `GET /api/v1/articles/:id`.
func (h *Handler) Get(c *gin.Context) {
	httpx.NotImplemented(c, "GET /articles/:id")
}

// Delete stubs `DELETE /api/v1/articles/:id`.
func (h *Handler) Delete(c *gin.Context) {
	httpx.NotImplemented(c, "DELETE /articles/:id")
}

// ExportMarkdown stubs `GET /api/v1/articles/:id/export.md`.
func (h *Handler) ExportMarkdown(c *gin.Context) {
	httpx.NotImplemented(c, "GET /articles/:id/export.md")
}

// NewModule wires repo → service → handler.
func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo)
	return NewHandler(svc)
}
