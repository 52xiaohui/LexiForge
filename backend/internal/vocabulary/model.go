package vocabulary

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// VocabWord mirrors the `vocab_words` table from docs/03-database.md.
// `unique(provider, provider_voc_id)` is the upsert key for sync/import flows.
type VocabWord struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Provider      string    `gorm:"type:varchar(32);not null;uniqueIndex:uq_vocab_words_provider_voc" json:"provider"`
	ProviderVocID string    `gorm:"type:varchar(64);not null;uniqueIndex:uq_vocab_words_provider_voc" json:"provider_voc_id"`
	Spelling      string    `gorm:"type:varchar(255);not null;index" json:"spelling"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (VocabWord) TableName() string { return "vocab_words" }

// StudyRecord mirrors the `study_records` table from docs/03-database.md.
// `unique(user_id, provider, provider_voc_id)` keeps repeated syncs idempotent.
type StudyRecord struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID      `gorm:"type:uuid;not null;index;uniqueIndex:uq_study_records_user_provider_voc" json:"user_id"`
	WordID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"word_id"`
	Provider       string         `gorm:"type:varchar(32);not null;uniqueIndex:uq_study_records_user_provider_voc" json:"provider"`
	ProviderVocID  string         `gorm:"type:varchar(64);not null;uniqueIndex:uq_study_records_user_provider_voc" json:"provider_voc_id"`
	LastResponse   string         `gorm:"type:varchar(32)" json:"last_response"`
	StudyCount     int            `gorm:"not null;default:0" json:"study_count"`
	Tags           datatypes.JSON `gorm:"type:jsonb" json:"tags"`
	AddDate        *time.Time     `json:"add_date,omitempty"`
	FirstStudyDate *time.Time     `json:"first_study_date,omitempty"`
	LastStudyDate  *time.Time     `json:"last_study_date,omitempty"`
	NextStudyDate  *time.Time     `json:"next_study_date,omitempty"`
	MasteryScore   int            `gorm:"not null;default:0" json:"mastery_score"`
	WeakScore      int            `gorm:"not null;default:0" json:"weak_score"`
	ScoreVersion   string         `gorm:"type:varchar(16);not null;default:'v1'" json:"score_version"`
	ScoreReasons   datatypes.JSON `gorm:"type:jsonb" json:"score_reasons"`
	LastScoredAt   *time.Time     `json:"last_scored_at,omitempty"`
	RawPayload     datatypes.JSON `gorm:"type:jsonb" json:"raw_payload,omitempty"`
	SyncedAt       *time.Time     `json:"synced_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (StudyRecord) TableName() string { return "study_records" }
