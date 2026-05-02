package article

import "gorm.io/gorm"

// Repository owns the GORM access for articles + article_words.
//
// docs/03-database.md specifies INSERT-only semantics for article_words —
// the future implementation must respect that.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }
