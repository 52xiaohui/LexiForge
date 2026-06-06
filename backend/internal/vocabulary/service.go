package vocabulary

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"lexiforge/backend/internal/user"
)

// Service holds the business logic for vocabulary operations.
type Service struct {
	repo repository
}

// NewService is the canonical constructor (used by NewModule and tests).
func NewService(repo repository) *Service { return &Service{repo: repo} }

type repository interface {
	ListRecords(opts ListOptions) (ListResult, error)
	GetRecord(userID, id uuid.UUID) (RecordRow, error)
	Summary(userID uuid.UUID) (Summary, error)
	UpsertPreference(userID, wordID uuid.UUID, input PreferenceInput) (UserWordPreference, error)
}

var (
	ErrRecordNotFound = errors.New("vocabulary record not found")
	ErrInvalidQuery   = errors.New("invalid vocabulary query")
)

type Query struct {
	Page         int
	PageSize     int
	Search       string
	LastResponse string
	Tag          string
	MinWeakScore *int
	MasteryTier  string
	Sort         string
}

type Record struct {
	ID             uuid.UUID      `json:"id"`
	UserID         uuid.UUID      `json:"user_id"`
	WordID         uuid.UUID      `json:"word_id"`
	Provider       string         `json:"provider"`
	ProviderVocID  string         `json:"provider_voc_id"`
	Spelling       string         `json:"spelling"`
	Translation    string         `json:"translation"`
	LastResponse   string         `json:"last_response"`
	StudyCount     int            `json:"study_count"`
	Tags           []string       `json:"tags"`
	AddDate        *time.Time     `json:"add_date,omitempty"`
	FirstStudyDate *time.Time     `json:"first_study_date,omitempty"`
	LastStudyDate  *time.Time     `json:"last_study_date,omitempty"`
	NextStudyDate  *time.Time     `json:"next_study_date,omitempty"`
	MasteryScore   int            `json:"mastery_score"`
	WeakScore      int            `json:"weak_score"`
	ScoreVersion   string         `json:"score_version"`
	ScoreReasons   map[string]int `json:"score_reasons"`
	Ignored        bool           `json:"ignored"`
	IgnoredReason  *string        `json:"ignored_reason,omitempty"`
	IgnoredUntil   *time.Time     `json:"ignored_until,omitempty"`
	Pinned         bool           `json:"pinned"`
	Recognized     bool           `json:"recognized"`
	Mastered       bool           `json:"mastered"`
	LastScoredAt   *time.Time     `json:"last_scored_at,omitempty"`
	SyncedAt       *time.Time     `json:"synced_at,omitempty"`
}

type PreferenceInput struct {
	Ignored       bool
	IgnoredReason *string
	IgnoredUntil  *time.Time
	Pinned        bool
}

type PreferenceRequest struct {
	Ignored       *bool      `json:"ignored"`
	IgnoredReason *string    `json:"ignored_reason"`
	IgnoredUntil  *time.Time `json:"ignored_until"`
	Pinned        *bool      `json:"pinned"`
}

type PreferenceResponse struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`
	WordID        uuid.UUID  `json:"word_id"`
	Ignored       bool       `json:"ignored"`
	IgnoredReason *string    `json:"ignored_reason,omitempty"`
	IgnoredUntil  *time.Time `json:"ignored_until,omitempty"`
	Pinned        bool       `json:"pinned"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type PagedRecords struct {
	Items    []Record `json:"items"`
	Total    int64    `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"page_size"`
}

func (s *Service) ListRecords(q Query) (PagedRecords, error) {
	return s.list(q, false)
}

func (s *Service) ListWeak(q Query) (PagedRecords, error) {
	return s.list(q, true)
}

func (s *Service) GetByID(id string) (Record, error) {
	recordID, err := uuid.Parse(id)
	if err != nil {
		return Record{}, fmt.Errorf("%w: invalid id", ErrInvalidQuery)
	}
	userID, err := localUserUUID()
	if err != nil {
		return Record{}, err
	}
	row, err := s.repo.GetRecord(userID, recordID)
	if err != nil {
		return Record{}, err
	}
	return mapRecord(row)
}

func (s *Service) UpdatePreference(id string, req PreferenceRequest) (PreferenceResponse, error) {
	recordID, err := uuid.Parse(id)
	if err != nil {
		return PreferenceResponse{}, fmt.Errorf("%w: invalid id", ErrInvalidQuery)
	}
	userID, err := localUserUUID()
	if err != nil {
		return PreferenceResponse{}, err
	}
	row, err := s.repo.GetRecord(userID, recordID)
	if err != nil {
		return PreferenceResponse{}, err
	}
	input, err := normalizePreferenceRequest(req)
	if err != nil {
		return PreferenceResponse{}, err
	}
	pref, err := s.repo.UpsertPreference(userID, row.WordID, input)
	if err != nil {
		return PreferenceResponse{}, err
	}
	return mapPreference(pref), nil
}

func (s *Service) Summary() (Summary, error) {
	userID, err := localUserUUID()
	if err != nil {
		return Summary{}, err
	}
	return s.repo.Summary(userID)
}

func (s *Service) list(q Query, weakOnly bool) (PagedRecords, error) {
	normalized, err := normalizeQuery(q)
	if err != nil {
		return PagedRecords{}, err
	}
	userID, err := localUserUUID()
	if err != nil {
		return PagedRecords{}, err
	}
	result, err := s.repo.ListRecords(ListOptions{
		UserID:       userID,
		Page:         normalized.Page,
		PageSize:     normalized.PageSize,
		Search:       normalized.Search,
		LastResponse: normalized.LastResponse,
		Tag:          normalized.Tag,
		MinWeakScore: normalized.MinWeakScore,
		MasteryTier:  normalized.MasteryTier,
		WeakOnly:     weakOnly,
		Sort:         normalized.Sort,
	})
	if err != nil {
		return PagedRecords{}, err
	}
	items := make([]Record, 0, len(result.Items))
	for _, row := range result.Items {
		item, err := mapRecord(row)
		if err != nil {
			return PagedRecords{}, err
		}
		items = append(items, item)
	}
	return PagedRecords{Items: items, Total: result.Total, Page: normalized.Page, PageSize: normalized.PageSize}, nil
}

func normalizeQuery(q Query) (Query, error) {
	if q.Page == 0 {
		q.Page = 1
	}
	if q.PageSize == 0 {
		q.PageSize = 50
	}
	if q.Page < 1 {
		return Query{}, fmt.Errorf("%w: page must be >= 1", ErrInvalidQuery)
	}
	if q.PageSize < 1 || q.PageSize > 200 {
		return Query{}, fmt.Errorf("%w: page_size must be between 1 and 200", ErrInvalidQuery)
	}
	if q.LastResponse != "" {
		raw := q.LastResponse
		q.LastResponse = NormalizeLastResponse(q.LastResponse)
		if q.LastResponse == "UNKNOWN" && !strings.EqualFold(strings.TrimSpace(raw), "UNKNOWN") {
			return Query{}, fmt.Errorf("%w: unsupported last_response", ErrInvalidQuery)
		}
	}
	if q.MinWeakScore != nil && *q.MinWeakScore < 0 {
		return Query{}, fmt.Errorf("%w: min_weak_score must be >= 0", ErrInvalidQuery)
	}
	q.Search = strings.TrimSpace(q.Search)
	q.Tag = strings.ToUpper(strings.TrimSpace(q.Tag))
	q.MasteryTier = strings.ToLower(strings.TrimSpace(q.MasteryTier))
	switch q.MasteryTier {
	case "", "mastered", "learning", "starting":
	default:
		return Query{}, fmt.Errorf("%w: unsupported mastery_tier", ErrInvalidQuery)
	}
	return q, nil
}

func normalizePreferenceRequest(req PreferenceRequest) (PreferenceInput, error) {
	ignored := false
	if req.Ignored != nil {
		ignored = *req.Ignored
	}
	pinned := false
	if req.Pinned != nil {
		pinned = *req.Pinned
	}
	var reason *string
	var until *time.Time
	if ignored {
		if req.IgnoredReason != nil {
			value := strings.TrimSpace(*req.IgnoredReason)
			if len(value) > 64 {
				return PreferenceInput{}, fmt.Errorf("%w: ignored_reason must be 64 characters or fewer", ErrInvalidQuery)
			}
			if value != "" {
				reason = &value
			}
		}
		until = req.IgnoredUntil
	}
	return PreferenceInput{
		Ignored:       ignored,
		IgnoredReason: reason,
		IgnoredUntil:  until,
		Pinned:        pinned,
	}, nil
}

func mapRecord(row RecordRow) (Record, error) {
	tags := []string{}
	if len(row.Tags) > 0 {
		if err := json.Unmarshal(row.Tags, &tags); err != nil {
			return Record{}, fmt.Errorf("decode tags: %w", err)
		}
	}
	reasons := map[string]int{}
	if len(row.ScoreReasons) > 0 {
		if err := json.Unmarshal(row.ScoreReasons, &reasons); err != nil {
			return Record{}, fmt.Errorf("decode score reasons: %w", err)
		}
	}
	return Record{
		ID:             row.ID,
		UserID:         row.UserID,
		WordID:         row.WordID,
		Provider:       row.Provider,
		ProviderVocID:  row.ProviderVocID,
		Spelling:       row.Spelling,
		Translation:    row.Translation,
		LastResponse:   row.LastResponse,
		StudyCount:     row.StudyCount,
		Tags:           tags,
		AddDate:        row.AddDate,
		FirstStudyDate: row.FirstStudyDate,
		LastStudyDate:  row.LastStudyDate,
		NextStudyDate:  row.NextStudyDate,
		MasteryScore:   row.MasteryScore,
		WeakScore:      row.WeakScore,
		ScoreVersion:   row.ScoreVersion,
		ScoreReasons:   reasons,
		Ignored:        row.Ignored,
		IgnoredReason:  row.IgnoredReason,
		IgnoredUntil:   row.IgnoredUntil,
		Pinned:         row.Pinned,
		Recognized:     row.Recognized,
		Mastered:       row.Mastered,
		LastScoredAt:   row.LastScoredAt,
		SyncedAt:       row.SyncedAt,
	}, nil
}

func mapPreference(row UserWordPreference) PreferenceResponse {
	return PreferenceResponse{
		ID:            row.ID,
		UserID:        row.UserID,
		WordID:        row.WordID,
		Ignored:       row.Ignored,
		IgnoredReason: row.IgnoredReason,
		IgnoredUntil:  row.IgnoredUntil,
		Pinned:        row.Pinned,
		UpdatedAt:     row.UpdatedAt,
	}
}

func localUserUUID() (uuid.UUID, error) {
	id, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("parse local user id: %w", err)
	}
	return id, nil
}
