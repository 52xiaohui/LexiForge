package article

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/ai"
	"lexiforge/backend/internal/httpx"
)

// Handler covers MVP article endpoints: generate / list / get / delete /
// markdown export.
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

func (h *Handler) Generate(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Respond(c, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON", nil)
		return
	}
	result, err := h.svc.Generate(c.Request.Context(), req)
	respond(c, result, err)
}

func (h *Handler) List(c *gin.Context) {
	page, ok := parseIntQuery(c, "page", 0)
	if !ok {
		return
	}
	pageSize, ok := parseIntQuery(c, "page_size", 0)
	if !ok {
		return
	}
	result, err := h.svc.List(c.Request.Context(), page, pageSize)
	respond(c, result, err)
}

func (h *Handler) Get(c *gin.Context) {
	result, err := h.svc.Get(c.Request.Context(), c.Param("id"))
	respond(c, result, err)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		respond(c, nil, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) ExportMarkdown(c *gin.Context) {
	body, err := h.svc.ExportMarkdown(c.Request.Context(), c.Param("id"))
	if err != nil {
		respond(c, nil, err)
		return
	}
	c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(body))
}

// NewModule wires repo -> service -> handler.
func NewModule(db *gorm.DB, aiClient ai.Client) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo, aiClient)
	return NewHandler(svc)
}

func parseIntQuery(c *gin.Context, key string, fallback int) (int, bool) {
	raw := c.Query(key)
	if raw == "" {
		return fallback, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		httpx.Respond(c, http.StatusBadRequest, "INVALID_QUERY", key+" must be an integer", nil)
		return 0, false
	}
	return value, true
}

func respond(c *gin.Context, data any, err error) {
	if err == nil {
		c.JSON(http.StatusOK, data)
		return
	}
	var apiErr APIError
	switch {
	case errors.As(err, &apiErr):
		httpx.Respond(c, apiErr.Status, apiErr.Code, apiErr.Message, apiErr.Details)
	case errors.Is(err, ErrArticleNotFound):
		httpx.Respond(c, http.StatusNotFound, "ARTICLE_NOT_FOUND", "article not found", nil)
	case errors.Is(err, ErrAIGenerationUnavailable), errors.Is(err, ai.ErrAPIKeyMissing):
		httpx.Respond(c, http.StatusServiceUnavailable, "AI_GENERATION_UNAVAILABLE", "AI article generation is not configured", nil)
	case errors.Is(err, ai.ErrGenerationFailed), errors.Is(err, ai.ErrInvalidAIResponse):
		httpx.Respond(c, http.StatusBadGateway, "AI_GENERATION_FAILED", "文章生成失败，请重试。", nil)
	default:
		httpx.Respond(c, http.StatusInternalServerError, "ARTICLE_OPERATION_FAILED", "article operation failed", nil)
	}
}
