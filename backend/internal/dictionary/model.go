package dictionary

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Entry stores source dictionary metadata separately from user study records.
// RawPayload keeps the original source object so future importers can recover
// fields without re-downloading the dataset.
type Entry struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Source             string         `gorm:"type:varchar(64);not null;uniqueIndex:uq_dictionary_entries_source_word" json:"source"`
	SourceWordID       string         `gorm:"type:varchar(128);not null;uniqueIndex:uq_dictionary_entries_source_word" json:"source_word_id"`
	SourceBookID       string         `gorm:"type:varchar(128);not null;index" json:"source_book_id"`
	Headword           string         `gorm:"type:varchar(255);not null;index" json:"headword"`
	NormalizedHeadword string         `gorm:"type:varchar(255);not null;index" json:"normalized_headword"`
	UKPhone            string         `gorm:"type:varchar(128);not null;default:''" json:"uk_phone"`
	USPhone            string         `gorm:"type:varchar(128);not null;default:''" json:"us_phone"`
	Translations       datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"translations"`
	Examples           datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"examples"`
	Phrases            datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"phrases"`
	Synonyms           datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"synonyms"`
	RelatedWords       datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"related_words"`
	Exams              datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"exams"`
	RawPayload         datatypes.JSON `gorm:"type:jsonb;not null" json:"raw_payload"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

func (Entry) TableName() string { return "dictionary_entries" }
