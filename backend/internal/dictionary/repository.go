package dictionary

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

var ErrEntryNotFound = errors.New("dictionary entry not found")

func (r *Repository) Lookup(ctx context.Context, normalized string) (Entry, error) {
	var row Entry
	err := r.db.WithContext(ctx).
		Where("normalized_headword = ?", normalized).
		Order("source_book_id ASC, source_word_id ASC").
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Entry{}, ErrEntryNotFound
	}
	return row, err
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (Entry, error) {
	var row Entry
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Entry{}, ErrEntryNotFound
	}
	return row, err
}

func (r *Repository) UpsertBatch(ctx context.Context, entries []Entry) error {
	if len(entries) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "source"},
			{Name: "source_word_id"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"source_book_id",
			"headword",
			"normalized_headword",
			"uk_phone",
			"us_phone",
			"translations",
			"examples",
			"phrases",
			"synonyms",
			"related_words",
			"exams",
			"raw_payload",
			"updated_at",
		}),
	}).CreateInBatches(entries, 500).Error
}
