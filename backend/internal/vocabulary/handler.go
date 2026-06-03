package vocabulary

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/httpx"
)

// Handler is the HTTP layer for vocabulary-related endpoints.
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

// ListRecords handles `GET /api/v1/vocab/records`.
func (h *Handler) ListRecords(c *gin.Context) {
	q, ok := parseQuery(c)
	if !ok {
		return
	}
	result, err := h.svc.ListRecords(q)
	respond(c, result, err)
}

// ListWeak handles `GET /api/v1/vocab/weak`.
func (h *Handler) ListWeak(c *gin.Context) {
	q, ok := parseQuery(c)
	if !ok {
		return
	}
	result, err := h.svc.ListWeak(q)
	respond(c, result, err)
}

// Summary handles `GET /api/v1/vocab/summary`.
func (h *Handler) Summary(c *gin.Context) {
	result, err := h.svc.Summary()
	respond(c, result, err)
}

// GetByID handles `GET /api/v1/vocab/:id`.
func (h *Handler) GetByID(c *gin.Context) {
	result, err := h.svc.GetByID(c.Param("id"))
	respond(c, result, err)
}

// NewModule wires repository → service → handler with the given DB.
//
// main.go calls this once; tests can replace the repo with an in-memory fake.
func NewModule(db *gorm.DB) *Handler {
	repo := NewRepository(db)
	svc := NewService(repo)
	return NewHandler(svc)
}

func parseQuery(c *gin.Context) (Query, bool) {
	page, ok := parseIntQuery(c, "page", 0)
	if !ok {
		return Query{}, false
	}
	pageSize, ok := parseIntQuery(c, "page_size", 0)
	if !ok {
		return Query{}, false
	}
	var minWeakScore *int
	if c.Query("min_weak_score") != "" {
		score, ok := parseIntQuery(c, "min_weak_score", 0)
		if !ok {
			return Query{}, false
		}
		minWeakScore = &score
	}
	return Query{
		Page:         page,
		PageSize:     pageSize,
		LastResponse: c.Query("last_response"),
		Tag:          c.Query("tag"),
		MinWeakScore: minWeakScore,
		Sort:         c.Query("sort"),
	}, true
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
	switch {
	case errors.Is(err, ErrInvalidQuery):
		httpx.Respond(c, http.StatusBadRequest, "INVALID_QUERY", err.Error(), nil)
	case errors.Is(err, ErrRecordNotFound):
		httpx.Respond(c, http.StatusNotFound, "VOCAB_RECORD_NOT_FOUND", "vocabulary record not found", nil)
	default:
		httpx.Respond(c, http.StatusInternalServerError, "VOCAB_QUERY_FAILED", "failed to query vocabulary records", nil)
	}
}
