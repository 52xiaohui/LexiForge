package user

import (
	"time"

	"github.com/google/uuid"
)

// LocalUserID is the fixed UUID used by the MVP single-user seed.
// All foreign keys point at this row until v0.5 introduces real registration.
const LocalUserID = "00000000-0000-0000-0000-000000000001"

// User mirrors the `users` table from docs/03-database.md.
// MVP only seeds a single row (LocalUserID); password_hash stays empty.
type User struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"type:varchar(255);not null;default:''" json:"-"`
	DisplayName  string     `gorm:"type:varchar(255);not null;default:''" json:"display_name"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

// TableName pins the table name so GORM's pluralization can never drift from docs.
func (User) TableName() string { return "users" }
