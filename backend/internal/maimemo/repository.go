package maimemo

import "gorm.io/gorm"

// Repository wraps DB access for sync — upserts study_records and reads the
// latest sync metadata.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }
