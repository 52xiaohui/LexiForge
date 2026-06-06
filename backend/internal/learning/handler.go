package learning

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

// Handler is the HTTP layer for learning-event endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds a learning handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Register attaches learning routes to /api/v1.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/word-events", h.CreateWordEvent)
}

// CreateWordEvent handles `POST /api/v1/word-events`.
func (h *Handler) CreateWordEvent(c *gin.Context) {
	var req EventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Respond(c, http.StatusBadRequest, "INVALID_WORD_EVENT_BODY", "word event request body is invalid", nil)
		return
	}
	result, err := h.svc.RecordEvent(c.Request.Context(), req)
	if err == nil {
		c.JSON(http.StatusCreated, result)
		return
	}
	switch {
	case errors.Is(err, ErrInvalidEvent):
		httpx.Respond(c, http.StatusBadRequest, "INVALID_WORD_EVENT", err.Error(), nil)
	case errors.Is(err, ErrEventWordNotFound):
		httpx.Respond(c, http.StatusNotFound, "WORD_EVENT_WORD_NOT_FOUND", "word not found for local user", nil)
	case errors.Is(err, ErrEventArticleNotFound):
		httpx.Respond(c, http.StatusNotFound, "WORD_EVENT_ARTICLE_NOT_FOUND", "article not found for local user", nil)
	default:
		httpx.Respond(c, http.StatusInternalServerError, "WORD_EVENT_CREATE_FAILED", "failed to create word event", nil)
	}
}

// NewModule wires repo -> service -> handler.
func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo)
	return NewHandler(svc)
}
