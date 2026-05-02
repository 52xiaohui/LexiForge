package maimemo

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

// Repository wraps DB access for sync — upserts study_records and reads the
// latest sync metadata.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

type UpsertStudyRecord struct {
	Provider      string
	ProviderVocID string
	Spelling      string

	LastResponse   string
	StudyCount     int
	Tags           []string
	AddDate        *time.Time
	FirstStudyDate *time.Time
	LastStudyDate  *time.Time
	NextStudyDate  *time.Time

	MasteryScore int
	WeakScore    int
	ScoreVersion string
	ScoreReasons map[string]int
	ScoredAt     time.Time
	SyncedAt     time.Time
	RawPayload   any
}

type UpsertResult struct {
	RecordsTotal    int `json:"records_total"`
	RecordsInserted int `json:"records_inserted"`
	RecordsUpdated  int `json:"records_updated"`
}

type LatestSync struct {
	Status       string     `json:"status"`
	RecordsTotal int        `json:"records_total"`
	LastSyncedAt *time.Time `json:"last_synced_at,omitempty"`
}

func (r *Repository) UpsertStudyRecords(records []UpsertStudyRecord) (UpsertResult, error) {
	result := UpsertResult{RecordsTotal: len(records)}
	if len(records) == 0 {
		return result, nil
	}

	userID, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return result, fmt.Errorf("parse local user id: %w", err)
	}

	err = r.db.Transaction(func(tx *gorm.DB) error {
		for _, record := range records {
			provider := strings.TrimSpace(record.Provider)
			providerVocID := strings.TrimSpace(record.ProviderVocID)
			spelling := strings.TrimSpace(record.Spelling)
			if provider == "" || providerVocID == "" || spelling == "" {
				return fmt.Errorf("invalid study record: provider, provider_voc_id and spelling are required")
			}

			word, err := upsertWord(tx, provider, providerVocID, spelling)
			if err != nil {
				return err
			}

			inserted, err := upsertStudyRecord(tx, userID, word.ID, record)
			if err != nil {
				return err
			}
			if inserted {
				result.RecordsInserted++
			} else {
				result.RecordsUpdated++
			}
		}
		return nil
	})
	if err != nil {
		return result, err
	}
	return result, nil
}

func (r *Repository) LatestSync() (LatestSync, error) {
	userID, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return LatestSync{}, fmt.Errorf("parse local user id: %w", err)
	}

	var total int64
	if err := r.db.Model(&vocabulary.StudyRecord{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return LatestSync{}, err
	}
	if total == 0 {
		return LatestSync{Status: "never_synced"}, nil
	}

	var latest vocabulary.StudyRecord
	err = r.db.Where("user_id = ? AND synced_at IS NOT NULL", userID).
		Order("synced_at DESC").
		First(&latest).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return LatestSync{Status: "never_synced", RecordsTotal: int(total)}, nil
	}
	if err != nil {
		return LatestSync{}, err
	}
	return LatestSync{
		Status:       "succeeded",
		RecordsTotal: int(total),
		LastSyncedAt: latest.SyncedAt,
	}, nil
}

func upsertWord(tx *gorm.DB, provider, providerVocID, spelling string) (vocabulary.VocabWord, error) {
	var word vocabulary.VocabWord
	err := tx.Where("provider = ? AND provider_voc_id = ?", provider, providerVocID).
		Assign(vocabulary.VocabWord{Spelling: spelling}).
		FirstOrCreate(&word, vocabulary.VocabWord{Provider: provider, ProviderVocID: providerVocID}).Error
	if err != nil {
		return vocabulary.VocabWord{}, fmt.Errorf("upsert vocab word %s/%s: %w", provider, providerVocID, err)
	}
	return word, nil
}

func upsertStudyRecord(tx *gorm.DB, userID, wordID uuid.UUID, record UpsertStudyRecord) (bool, error) {
	tagsJSON, err := marshalJSON(record.Tags)
	if err != nil {
		return false, fmt.Errorf("marshal tags: %w", err)
	}
	reasonsJSON, err := marshalJSON(record.ScoreReasons)
	if err != nil {
		return false, fmt.Errorf("marshal score reasons: %w", err)
	}
	rawJSON, err := marshalJSON(record.RawPayload)
	if err != nil {
		return false, fmt.Errorf("marshal raw payload: %w", err)
	}

	values := vocabulary.StudyRecord{
		UserID:         userID,
		WordID:         wordID,
		Provider:       record.Provider,
		ProviderVocID:  record.ProviderVocID,
		LastResponse:   record.LastResponse,
		StudyCount:     record.StudyCount,
		Tags:           tagsJSON,
		AddDate:        record.AddDate,
		FirstStudyDate: record.FirstStudyDate,
		LastStudyDate:  record.LastStudyDate,
		NextStudyDate:  record.NextStudyDate,
		MasteryScore:   record.MasteryScore,
		WeakScore:      record.WeakScore,
		ScoreVersion:   record.ScoreVersion,
		ScoreReasons:   reasonsJSON,
		LastScoredAt:   &record.ScoredAt,
		RawPayload:     rawJSON,
		SyncedAt:       &record.SyncedAt,
	}

	var existing vocabulary.StudyRecord
	err = tx.Where("user_id = ? AND provider = ? AND provider_voc_id = ?", userID, record.Provider, record.ProviderVocID).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := tx.Create(&values).Error; err != nil {
			return false, fmt.Errorf("create study record %s/%s: %w", record.Provider, record.ProviderVocID, err)
		}
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("find study record %s/%s: %w", record.Provider, record.ProviderVocID, err)
	}

	values.ID = existing.ID
	updates := map[string]any{
		"word_id":          values.WordID,
		"last_response":    values.LastResponse,
		"study_count":      values.StudyCount,
		"tags":             values.Tags,
		"add_date":         values.AddDate,
		"first_study_date": values.FirstStudyDate,
		"last_study_date":  values.LastStudyDate,
		"next_study_date":  values.NextStudyDate,
		"mastery_score":    values.MasteryScore,
		"weak_score":       values.WeakScore,
		"score_version":    values.ScoreVersion,
		"score_reasons":    values.ScoreReasons,
		"last_scored_at":   values.LastScoredAt,
		"raw_payload":      values.RawPayload,
		"synced_at":        values.SyncedAt,
	}
	if err := tx.Model(&existing).Updates(updates).Error; err != nil {
		return false, fmt.Errorf("update study record %s/%s: %w", record.Provider, record.ProviderVocID, err)
	}
	return false, nil
}

func marshalJSON(value any) (datatypes.JSON, error) {
	if value == nil {
		return nil, nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(data), nil
}
