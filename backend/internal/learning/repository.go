package learning

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository owns persistence for LexiForge-local learning events.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) UserOwnsWord(ctx context.Context, userID, wordID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("study_records").
		Where("user_id = ? AND word_id = ?", userID, wordID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) ArticleBelongsToUser(ctx context.Context, userID, articleID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("articles").
		Where("user_id = ? AND id = ? AND deleted_at IS NULL", userID, articleID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) CreateEvent(ctx context.Context, event WordLearningEvent) (WordLearningEvent, error) {
	if err := r.db.WithContext(ctx).Create(&event).Error; err != nil {
		return WordLearningEvent{}, err
	}
	return event, nil
}
