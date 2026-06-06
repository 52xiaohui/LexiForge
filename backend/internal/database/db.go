// Package database wraps GORM connection setup, schema migration, and seed data.
//
// MVP keeps things simple: AutoMigrate creates the application tables on every boot,
// pgcrypto is enabled so `gen_random_uuid()` works, and a single local-user
// row is seeded so all FKs have a target. v0.5 will swap AutoMigrate for a
// proper migration tool (goose / golang-migrate).
package database

import (
	"fmt"
	"log/slog"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"lexiforge/backend/internal/config"
)

// Open dials Postgres and returns a configured *gorm.DB.
//
// Gin's recover middleware handles request-time panics; this only fails at
// boot, where main.go logs the error and exits.
func Open(cfg config.Config) (*gorm.DB, error) {
	gormLogger := logger.Default.LogMode(logger.Warn)
	if !cfg.IsProduction() {
		gormLogger = logger.Default.LogMode(logger.Info)
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("acquire sql.DB: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	slog.Info("postgres connected")
	return db, nil
}
