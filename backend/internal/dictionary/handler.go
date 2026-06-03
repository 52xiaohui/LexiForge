package dictionary

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	return NewHandler(NewService(repo))
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/dictionary")
	g.GET("/lookup", h.Lookup)
}

func (h *Handler) Lookup(c *gin.Context) {
	word := c.Query("word")
	result, err := h.svc.Lookup(c.Request.Context(), word)
	if err == nil {
		c.JSON(http.StatusOK, result)
		return
	}
	switch {
	case errors.Is(err, ErrEntryNotFound):
		httpx.Respond(c, http.StatusNotFound, "DICTIONARY_ENTRY_NOT_FOUND", "dictionary entry not found", nil)
	case err.Error() == "word is required":
		httpx.Respond(c, http.StatusBadRequest, "WORD_REQUIRED", "word query parameter is required", nil)
	default:
		httpx.Respond(c, http.StatusInternalServerError, "DICTIONARY_LOOKUP_FAILED", "failed to lookup dictionary entry", nil)
	}
}
