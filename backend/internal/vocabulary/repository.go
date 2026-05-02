package vocabulary

import "gorm.io/gorm"

// Repository owns the GORM access for vocab_words and study_records.
//
// MVP keeps this empty; once sync lands the upsert / scoring queries live
// here, never on the handler.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB so the service layer never imports gorm.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }
