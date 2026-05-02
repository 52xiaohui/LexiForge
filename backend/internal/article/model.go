package article

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Article mirrors the `articles` table from docs/03-database.md.
// MVP-only fields; ai_usage_logs / exercises are introduced later.
type Article struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID           uuid.UUID       `gorm:"type:uuid;not null;index" json:"user_id"`
	Title            string          `gorm:"type:varchar(255);not null;default:''" json:"title"`
	Topic            string          `gorm:"type:varchar(128);not null;default:''" json:"topic"`
	Difficulty       string          `gorm:"type:varchar(32);not null;default:''" json:"difficulty"`
	ContentMarkdown  string          `gorm:"type:text;not null;default:''" json:"content_markdown"`
	Summary          string          `gorm:"type:text;not null;default:''" json:"summary"`
	TargetWordCount  int             `gorm:"not null;default:0" json:"target_word_count"`
	CoveredWordCount int             `gorm:"not null;default:0" json:"covered_word_count"`
	CoverageRate     decimal.Decimal `gorm:"type:decimal(6,4);not null;default:0" json:"coverage_rate"`
	GenerationStatus string          `gorm:"type:varchar(32);not null;default:'pending'" json:"generation_status"`
	ModelName        string          `gorm:"type:varchar(64);not null;default:''" json:"model_name"`
	PromptVersion    string          `gorm:"type:varchar(16);not null;default:'v1'" json:"prompt_version"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        *time.Time      `gorm:"index" json:"deleted_at,omitempty"`
}

func (Article) TableName() string { return "articles" }

// ArticleWord mirrors the `article_words` table from docs/03-database.md.
// Defensive `unique(article_id, word_id)` — duplicate inserts indicate a bug.
type ArticleWord struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ArticleID     uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:uq_article_words_article_word" json:"article_id"`
	WordID        uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:uq_article_words_article_word" json:"word_id"`
	Spelling      string    `gorm:"type:varchar(255);not null" json:"spelling"`
	Form          *string   `gorm:"type:varchar(255)" json:"form,omitempty"`
	Occurrence    *int      `json:"occurrence,omitempty"`
	ContextBefore *string   `gorm:"type:varchar(64)" json:"context_before,omitempty"`
	ContextAfter  *string   `gorm:"type:varchar(64)" json:"context_after,omitempty"`
	CharOffset    *int      `json:"char_offset,omitempty"`
	CharLength    *int      `json:"char_length,omitempty"`
	IsCovered     bool      `gorm:"not null;default:false" json:"is_covered"`
	CreatedAt     time.Time `json:"created_at"`
}

func (ArticleWord) TableName() string { return "article_words" }
