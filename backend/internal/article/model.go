package article

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"

	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

// Article mirrors the `articles` table from docs/core/data-model.md.
// MVP-only fields; ai_usage_logs / exercises are introduced later.
type Article struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID               uuid.UUID       `gorm:"type:uuid;not null;index" json:"user_id"`
	Title                string          `gorm:"type:varchar(255);not null;default:''" json:"title"`
	Topic                string          `gorm:"type:varchar(128);not null;default:''" json:"topic"`
	Difficulty           string          `gorm:"type:varchar(32);not null;default:''" json:"difficulty"`
	ArticleLength        string          `gorm:"type:varchar(16);not null;default:'medium'" json:"article_length"`
	ContentMarkdown      string          `gorm:"type:text;not null;default:''" json:"content_markdown"`
	Summary              string          `gorm:"type:text;not null;default:''" json:"summary"`
	GenerationParams     datatypes.JSON  `gorm:"type:jsonb;not null;default:'{}'" json:"generation_params"`
	TargetWordCount      int             `gorm:"not null;default:0" json:"target_word_count"`
	CoveredWordCount     int             `gorm:"not null;default:0" json:"covered_word_count"`
	CoverageRate         decimal.Decimal `gorm:"type:decimal(6,4);not null;default:0" json:"coverage_rate"`
	GenerationStatus     string          `gorm:"type:varchar(32);not null;default:'pending'" json:"generation_status"`
	ModelName            string          `gorm:"type:varchar(64);not null;default:''" json:"model_name"`
	PromptVersion        string          `gorm:"type:varchar(16);not null;default:'v1'" json:"prompt_version"`
	GenerationAttempts   int             `gorm:"not null;default:0" json:"generation_attempts"`
	GenerationDurationMS int64           `gorm:"not null;default:0" json:"generation_duration_ms"`
	InputTokens          int             `gorm:"not null;default:0" json:"input_tokens"`
	OutputTokens         int             `gorm:"not null;default:0" json:"output_tokens"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
	DeletedAt            *time.Time      `gorm:"index" json:"deleted_at,omitempty"`
	User                 user.User       `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (Article) TableName() string { return "articles" }

// ArticleGenerationRun records every paid generation operation, including
// failures that never produce an Article row.
type ArticleGenerationRun struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID       `gorm:"type:uuid;not null;index" json:"user_id"`
	ArticleID       *uuid.UUID      `gorm:"type:uuid;index" json:"article_id,omitempty"`
	Status          string          `gorm:"type:varchar(32);not null;default:'running';index" json:"status"`
	Topic           string          `gorm:"type:varchar(128);not null;default:''" json:"topic"`
	Difficulty      string          `gorm:"type:varchar(32);not null;default:''" json:"difficulty"`
	ArticleLength   string          `gorm:"type:varchar(16);not null;default:'medium'" json:"article_length"`
	TargetWordCount int             `gorm:"not null;default:0" json:"target_word_count"`
	ModelName       string          `gorm:"type:varchar(64);not null;default:''" json:"model_name"`
	PromptVersion   string          `gorm:"type:varchar(16);not null;default:'v1'" json:"prompt_version"`
	AttemptCount    int             `gorm:"not null;default:0" json:"attempt_count"`
	InputTokens     int             `gorm:"not null;default:0" json:"input_tokens"`
	OutputTokens    int             `gorm:"not null;default:0" json:"output_tokens"`
	DurationMS      int64           `gorm:"not null;default:0" json:"duration_ms"`
	CoverageRate    decimal.Decimal `gorm:"type:decimal(6,4);not null;default:0" json:"coverage_rate"`
	ErrorCode       string          `gorm:"type:varchar(64);not null;default:''" json:"error_code"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	User            user.User       `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Article         *Article        `gorm:"foreignKey:ArticleID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (ArticleGenerationRun) TableName() string { return "article_generation_runs" }

// ArticleWord mirrors the `article_words` table from docs/core/data-model.md.
// Defensive `unique(article_id, word_id)` — duplicate inserts indicate a bug.
//
// Learning-signal fields (StudyRecordID … Mastered) are read-only joins used by
// GetArticle so the reader can render target popovers without loading the full
// vocabulary index. They are never persisted on article_words.
type ArticleWord struct {
	ID            uuid.UUID            `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ArticleID     uuid.UUID            `gorm:"type:uuid;not null;index;uniqueIndex:uq_article_words_article_word" json:"article_id"`
	WordID        uuid.UUID            `gorm:"type:uuid;not null;uniqueIndex:uq_article_words_article_word" json:"word_id"`
	Spelling      string               `gorm:"type:varchar(255);not null" json:"spelling"`
	Translation   string               `gorm:"->;-:migration;column:translation" json:"translation"`
	Form          *string              `gorm:"type:varchar(255)" json:"form,omitempty"`
	Occurrence    *int                 `json:"occurrence,omitempty"`
	ContextBefore *string              `gorm:"type:varchar(64)" json:"context_before,omitempty"`
	ContextAfter  *string              `gorm:"type:varchar(64)" json:"context_after,omitempty"`
	CharOffset    *int                 `json:"char_offset,omitempty"`
	CharLength    *int                 `json:"char_length,omitempty"`
	IsCovered     bool                 `gorm:"not null;default:false" json:"is_covered"`
	CreatedAt     time.Time            `json:"created_at"`
	// Joined study / preference / event signals (GetArticle only).
	StudyRecordID *uuid.UUID `gorm:"->;column:study_record_id" json:"study_record_id,omitempty"`
	LastResponse  string     `gorm:"->;column:last_response" json:"last_response,omitempty"`
	StudyCount    int        `gorm:"->;column:study_count" json:"study_count"`
	MasteryScore  int        `gorm:"->;column:mastery_score" json:"mastery_score"`
	WeakScore     int        `gorm:"->;column:weak_score" json:"weak_score"`
	Recognized    bool       `gorm:"->;column:recognized" json:"recognized"`
	Mastered      bool       `gorm:"->;column:mastered" json:"mastered"`
	Ignored       bool       `gorm:"->;column:ignored" json:"ignored"`
	Article       Article              `gorm:"foreignKey:ArticleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Word          vocabulary.VocabWord `gorm:"foreignKey:WordID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (ArticleWord) TableName() string { return "article_words" }

const (
	ArticleProgressUnread  = "unread"
	ArticleProgressReading = "reading"
	ArticleProgressRead    = "read"
)

// UserArticleProgress stores per-user reading progress. Reading status is an
// article-level signal; it does not imply target-word mastery.
type UserArticleProgress struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID  `gorm:"type:uuid;not null;index;uniqueIndex:uq_user_article_progress_user_article" json:"user_id"`
	ArticleID          uuid.UUID  `gorm:"type:uuid;not null;index;uniqueIndex:uq_user_article_progress_user_article" json:"article_id"`
	Status             string     `gorm:"type:varchar(16);not null;default:'unread'" json:"status"`
	ProgressPercent    int        `gorm:"not null;default:0" json:"progress_percent"`
	LastParagraphIndex *int       `json:"last_paragraph_index,omitempty"`
	StartedAt          *time.Time `json:"started_at,omitempty"`
	CompletedAt        *time.Time `json:"completed_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	User               user.User  `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Article            Article    `gorm:"foreignKey:ArticleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (UserArticleProgress) TableName() string { return "user_article_progress" }
