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
	"gorm.io/gorm/clause"

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

type studyRecordKey struct {
	provider      string
	providerVocID string
}

type normalizedStudyRecord struct {
	key    studyRecordKey
	record UpsertStudyRecord
}

const upsertBatchSize = 500

func (r *Repository) UpsertStudyRecords(records []UpsertStudyRecord) (UpsertResult, error) {
	result := UpsertResult{RecordsTotal: len(records)}
	if len(records) == 0 {
		return result, nil
	}

	userID, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return result, fmt.Errorf("parse local user id: %w", err)
	}

	normalized, words, err := normalizeStudyRecords(records)
	if err != nil {
		return result, err
	}
	result.RecordsTotal = len(normalized)

	err = r.db.Transaction(func(tx *gorm.DB) error {
		if err := batchUpsertWords(tx, words); err != nil {
			return err
		}
		wordIDs, err := loadWordIDs(tx, normalized)
		if err != nil {
			return err
		}
		existing, err := loadExistingStudyRecordKeys(tx, userID, normalized)
		if err != nil {
			return err
		}
		studyRows, err := buildStudyRows(userID, wordIDs, normalized)
		if err != nil {
			return err
		}
		if err := batchUpsertStudyRows(tx, studyRows); err != nil {
			return err
		}
		for _, item := range normalized {
			if existing[item.key] {
				result.RecordsUpdated++
			} else {
				result.RecordsInserted++
			}
		}
		return nil
	})
	if err != nil {
		return result, err
	}
	return result, nil
}

func normalizeStudyRecords(records []UpsertStudyRecord) ([]normalizedStudyRecord, []vocabulary.VocabWord, error) {
	normalized := make([]normalizedStudyRecord, 0, len(records))
	indexByKey := make(map[studyRecordKey]int, len(records))

	for _, record := range records {
		provider := strings.TrimSpace(record.Provider)
		providerVocID := strings.TrimSpace(record.ProviderVocID)
		spelling := strings.TrimSpace(record.Spelling)
		if provider == "" || providerVocID == "" || spelling == "" {
			return nil, nil, fmt.Errorf("invalid study record: provider, provider_voc_id and spelling are required")
		}

		record.Provider = provider
		record.ProviderVocID = providerVocID
		record.Spelling = spelling
		key := studyRecordKey{provider: provider, providerVocID: providerVocID}
		item := normalizedStudyRecord{key: key, record: record}
		if idx, ok := indexByKey[key]; ok {
			normalized[idx] = item
			continue
		}
		indexByKey[key] = len(normalized)
		normalized = append(normalized, item)
	}

	words := make([]vocabulary.VocabWord, 0, len(normalized))
	for _, item := range normalized {
		words = append(words, vocabulary.VocabWord{
			Provider:      item.record.Provider,
			ProviderVocID: item.record.ProviderVocID,
			Spelling:      item.record.Spelling,
		})
	}
	return normalized, words, nil
}

func batchUpsertWords(tx *gorm.DB, words []vocabulary.VocabWord) error {
	if len(words) == 0 {
		return nil
	}
	err := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "provider"}, {Name: "provider_voc_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"spelling",
			"updated_at",
		}),
	}).CreateInBatches(words, upsertBatchSize).Error
	if err != nil {
		return fmt.Errorf("batch upsert vocab words: %w", err)
	}
	return nil
}

func loadWordIDs(tx *gorm.DB, records []normalizedStudyRecord) (map[studyRecordKey]uuid.UUID, error) {
	wordIDs := make(map[studyRecordKey]uuid.UUID, len(records))
	for _, batch := range studyRecordPairBatches(records, upsertBatchSize) {
		var words []vocabulary.VocabWord
		if err := tx.Where("(provider, provider_voc_id) IN ?", batch).Find(&words).Error; err != nil {
			return nil, fmt.Errorf("load vocab word ids: %w", err)
		}
		for _, word := range words {
			key := studyRecordKey{provider: word.Provider, providerVocID: word.ProviderVocID}
			wordIDs[key] = word.ID
		}
	}

	if len(wordIDs) != len(records) {
		return nil, fmt.Errorf("load vocab word ids: got %d rows, want %d", len(wordIDs), len(records))
	}
	return wordIDs, nil
}

func loadExistingStudyRecordKeys(tx *gorm.DB, userID uuid.UUID, records []normalizedStudyRecord) (map[studyRecordKey]bool, error) {
	existingKeys := make(map[studyRecordKey]bool, len(records))
	for _, batch := range studyRecordPairBatches(records, upsertBatchSize) {
		var existing []vocabulary.StudyRecord
		err := tx.Select("provider", "provider_voc_id").
			Where("user_id = ? AND (provider, provider_voc_id) IN ?", userID, batch).
			Find(&existing).Error
		if err != nil {
			return nil, fmt.Errorf("load existing study records: %w", err)
		}
		for _, row := range existing {
			existingKeys[studyRecordKey{provider: row.Provider, providerVocID: row.ProviderVocID}] = true
		}
	}
	return existingKeys, nil
}

func buildStudyRows(userID uuid.UUID, wordIDs map[studyRecordKey]uuid.UUID, records []normalizedStudyRecord) ([]vocabulary.StudyRecord, error) {
	rows := make([]vocabulary.StudyRecord, 0, len(records))
	for _, item := range records {
		wordID, ok := wordIDs[item.key]
		if !ok {
			return nil, fmt.Errorf("missing vocab word id for %s/%s", item.key.provider, item.key.providerVocID)
		}
		row, err := buildStudyRow(userID, wordID, item.record)
		if err != nil {
			return nil, err
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func buildStudyRow(userID, wordID uuid.UUID, record UpsertStudyRecord) (vocabulary.StudyRecord, error) {
	tagsJSON, err := marshalJSON(record.Tags)
	if err != nil {
		return vocabulary.StudyRecord{}, fmt.Errorf("marshal tags: %w", err)
	}
	reasonsJSON, err := marshalJSON(record.ScoreReasons)
	if err != nil {
		return vocabulary.StudyRecord{}, fmt.Errorf("marshal score reasons: %w", err)
	}
	rawJSON, err := marshalJSON(record.RawPayload)
	if err != nil {
		return vocabulary.StudyRecord{}, fmt.Errorf("marshal raw payload: %w", err)
	}
	return vocabulary.StudyRecord{
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
	}, nil
}

func batchUpsertStudyRows(tx *gorm.DB, rows []vocabulary.StudyRecord) error {
	if len(rows) == 0 {
		return nil
	}
	err := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "provider"}, {Name: "provider_voc_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"word_id",
			"last_response",
			"study_count",
			"tags",
			"add_date",
			"first_study_date",
			"last_study_date",
			"next_study_date",
			"mastery_score",
			"weak_score",
			"score_version",
			"score_reasons",
			"last_scored_at",
			"raw_payload",
			"synced_at",
			"updated_at",
		}),
	}).CreateInBatches(rows, upsertBatchSize).Error
	if err != nil {
		return fmt.Errorf("batch upsert study records: %w", err)
	}
	return nil
}

func studyRecordPairs(records []normalizedStudyRecord) [][]any {
	pairs := make([][]any, 0, len(records))
	for _, item := range records {
		pairs = append(pairs, []any{item.key.provider, item.key.providerVocID})
	}
	return pairs
}

func studyRecordPairBatches(records []normalizedStudyRecord, size int) [][][]any {
	pairs := studyRecordPairs(records)
	if len(pairs) == 0 {
		return nil
	}
	batches := make([][][]any, 0, (len(pairs)+size-1)/size)
	for start := 0; start < len(pairs); start += size {
		end := start + size
		if end > len(pairs) {
			end = len(pairs)
		}
		batches = append(batches, pairs[start:end])
	}
	return batches
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
