package learning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"lexiforge/backend/internal/user"
)

// Service records LexiForge-local learning signals.
type Service struct {
	repo repository
}

// NewService is the canonical constructor.
func NewService(repo repository) *Service { return &Service{repo: repo} }

type repository interface {
	UserOwnsWord(ctx context.Context, userID, wordID uuid.UUID) (bool, error)
	ArticleBelongsToUser(ctx context.Context, userID, articleID uuid.UUID) (bool, error)
	CreateEvent(ctx context.Context, event WordLearningEvent) (WordLearningEvent, error)
}

var (
	ErrInvalidEvent         = errors.New("invalid word learning event")
	ErrEventWordNotFound    = errors.New("word not found for local user")
	ErrEventArticleNotFound = errors.New("article not found for local user")
)

type EventRequest struct {
	WordID    string         `json:"word_id"`
	ArticleID *string        `json:"article_id"`
	EventType string         `json:"event_type"`
	Source    string         `json:"source"`
	Metadata  map[string]any `json:"metadata"`
}

type EventResponse struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	WordID    uuid.UUID       `json:"word_id"`
	ArticleID *uuid.UUID      `json:"article_id,omitempty"`
	EventType string          `json:"event_type"`
	Source    string          `json:"source"`
	Metadata  json.RawMessage `json:"metadata"`
	CreatedAt time.Time       `json:"created_at"`
}

func (s *Service) RecordEvent(ctx context.Context, req EventRequest) (EventResponse, error) {
	normalized, err := normalizeEventRequest(req)
	if err != nil {
		return EventResponse{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return EventResponse{}, err
	}
	ownsWord, err := s.repo.UserOwnsWord(ctx, userID, normalized.WordID)
	if err != nil {
		return EventResponse{}, err
	}
	if !ownsWord {
		return EventResponse{}, ErrEventWordNotFound
	}
	if normalized.ArticleID != nil {
		ownsArticle, err := s.repo.ArticleBelongsToUser(ctx, userID, *normalized.ArticleID)
		if err != nil {
			return EventResponse{}, err
		}
		if !ownsArticle {
			return EventResponse{}, ErrEventArticleNotFound
		}
	}
	row, err := s.repo.CreateEvent(ctx, WordLearningEvent{
		UserID:    userID,
		WordID:    normalized.WordID,
		ArticleID: normalized.ArticleID,
		EventType: normalized.EventType,
		Source:    normalized.Source,
		Metadata:  normalized.Metadata,
	})
	if err != nil {
		return EventResponse{}, err
	}
	return mapEvent(row), nil
}

type normalizedEventRequest struct {
	WordID    uuid.UUID
	ArticleID *uuid.UUID
	EventType string
	Source    string
	Metadata  datatypes.JSON
}

func normalizeEventRequest(req EventRequest) (normalizedEventRequest, error) {
	wordID, err := uuid.Parse(strings.TrimSpace(req.WordID))
	if err != nil {
		return normalizedEventRequest{}, fmt.Errorf("%w: word_id must be a UUID", ErrInvalidEvent)
	}
	var articleID *uuid.UUID
	if req.ArticleID != nil && strings.TrimSpace(*req.ArticleID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ArticleID))
		if err != nil {
			return normalizedEventRequest{}, fmt.Errorf("%w: article_id must be a UUID", ErrInvalidEvent)
		}
		articleID = &parsed
	}
	eventType := strings.TrimSpace(req.EventType)
	if !isSupportedEventType(eventType) {
		return normalizedEventRequest{}, fmt.Errorf("%w: unsupported event_type", ErrInvalidEvent)
	}
	source := strings.TrimSpace(req.Source)
	if source == "" || len(source) > 64 {
		return normalizedEventRequest{}, fmt.Errorf("%w: source is required and must be 64 characters or fewer", ErrInvalidEvent)
	}
	if req.Metadata == nil {
		req.Metadata = map[string]any{}
	}
	metadata, err := json.Marshal(req.Metadata)
	if err != nil {
		return normalizedEventRequest{}, fmt.Errorf("%w: metadata must be a JSON object", ErrInvalidEvent)
	}
	return normalizedEventRequest{
		WordID:    wordID,
		ArticleID: articleID,
		EventType: eventType,
		Source:    source,
		Metadata:  datatypes.JSON(metadata),
	}, nil
}

func isSupportedEventType(eventType string) bool {
	switch eventType {
	case EventRecognizedInContext, EventFailedInContext, EventManuallyMastered, EventExposedInArticle:
		return true
	default:
		return false
	}
}

func mapEvent(row WordLearningEvent) EventResponse {
	return EventResponse{
		ID:        row.ID,
		UserID:    row.UserID,
		WordID:    row.WordID,
		ArticleID: row.ArticleID,
		EventType: row.EventType,
		Source:    row.Source,
		Metadata:  json.RawMessage(row.Metadata),
		CreatedAt: row.CreatedAt,
	}
}

func localUserID() (uuid.UUID, error) {
	id, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("parse local user id: %w", err)
	}
	return id, nil
}
