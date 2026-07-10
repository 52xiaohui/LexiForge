package learning

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"lexiforge/backend/internal/article"
	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

const (
	EventRecognizedInContext = "recognized_in_context"
	EventFailedInContext     = "failed_in_context"
	EventManuallyMastered    = "manually_mastered"
	EventExposedInArticle    = "exposed_in_article"
)

// WordLearningEvent stores LexiForge-local learning signals. These events are
// intentionally separate from synced StudyRecord facts so external-assist mode
// never pretends to modify the upstream app's state.
type WordLearningEvent struct {
	ID        uuid.UUID            `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID            `gorm:"type:uuid;not null;index;index:idx_word_learning_events_recommendation,priority:1" json:"user_id"`
	WordID    uuid.UUID            `gorm:"type:uuid;not null;index;index:idx_word_learning_events_recommendation,priority:2" json:"word_id"`
	ArticleID *uuid.UUID           `gorm:"type:uuid;index" json:"article_id,omitempty"`
	EventType string               `gorm:"type:varchar(64);not null;index;index:idx_word_learning_events_recommendation,priority:3" json:"event_type"`
	Source    string               `gorm:"type:varchar(64);not null;default:''" json:"source"`
	Metadata  datatypes.JSON       `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	CreatedAt time.Time            `gorm:"index:idx_word_learning_events_recommendation,priority:4,sort:desc" json:"created_at"`
	User      user.User            `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Word      vocabulary.VocabWord `gorm:"foreignKey:WordID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Article   *article.Article     `gorm:"foreignKey:ArticleID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (WordLearningEvent) TableName() string { return "word_learning_events" }
