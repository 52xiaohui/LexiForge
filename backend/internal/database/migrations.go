package database

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lexiforge/backend/internal/article"
	"lexiforge/backend/internal/dictionary"
	"lexiforge/backend/internal/learning"
	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

// RunMigrations enables pgcrypto, applies AutoMigrate for the MVP tables,
// and seeds the fixed local-user row.
//
// Idempotent: rerunning it is a no-op once the schema and seed exist. Tests
// can rely on this to set up clean state.
func RunMigrations(db *gorm.DB) error {
	// CREATE EXTENSION IF NOT EXISTS can still race in pg_extension when two
	// instances boot together. A database-scoped transaction lock serializes the
	// complete migration batch without requiring an external migration service.
	const migrationLockID int64 = 0x4c657869466f7267
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SELECT pg_advisory_xact_lock(?)`, migrationLockID).Error; err != nil {
			return fmt.Errorf("acquire migration lock: %w", err)
		}
		if err := tx.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public`).Error; err != nil {
			return fmt.Errorf("enable pgcrypto: %w", err)
		}
		if err := tx.AutoMigrate(
			&user.User{},
			&vocabulary.VocabWord{},
			&vocabulary.StudyRecord{},
			&vocabulary.UserWordPreference{},
			&dictionary.Entry{},
			&article.Article{},
			&article.ArticleGenerationRun{},
			&article.ArticleWord{},
			&article.UserArticleProgress{},
			&learning.WordLearningEvent{},
		); err != nil {
			return fmt.Errorf("auto migrate: %w", err)
		}
		if err := seedLocalUser(tx); err != nil {
			return fmt.Errorf("seed local user: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}

	slog.Info("migrations applied", "tables", []string{
		"users", "vocab_words", "study_records", "user_word_preferences",
		"dictionary_entries", "articles", "article_generation_runs", "article_words", "user_article_progress",
		"word_learning_events",
	})
	return nil
}

// seedLocalUser inserts the fixed-UUID single-user row used for the MVP.
//
// Use ON CONFLICT DO NOTHING so a restart doesn't error out and so v0.5 can
// safely add real users without colliding with the seed.
func seedLocalUser(db *gorm.DB) error {
	id, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return fmt.Errorf("parse LocalUserID: %w", err)
	}
	row := user.User{
		ID:           id,
		Email:        "local@localhost",
		DisplayName:  "Local User",
		PasswordHash: "",
		LearningMode: user.LearningModeExternalAssist,
	}
	res := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&row)
	if res.Error != nil && !errors.Is(res.Error, gorm.ErrDuplicatedKey) {
		return res.Error
	}
	if res.RowsAffected == 0 {
		slog.Info("local user already exists, skipping seed", "id", user.LocalUserID)
	} else {
		slog.Info("local user seeded", "id", user.LocalUserID)
	}
	return nil
}
