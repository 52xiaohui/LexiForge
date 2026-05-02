package export

import "gorm.io/gorm"

// Repository owns DB access for export streaming. MVP empty.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }
