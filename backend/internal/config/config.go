// Package config loads runtime configuration from environment variables.
//
// Defaults match docker-compose.yml at the repo root so a `docker compose up`
// works out of the box. Real secrets (MAIMEMO_TOKEN, OPENAI_API_KEY, ...) are
// never given a non-empty default — they must come from the environment.
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config is the canonical runtime config snapshot. main.go calls Load once
// at startup and passes the value down by reference.
type Config struct {
	AppEnv      string // development | production
	AppPort     string // ":8080"-style port
	DatabaseURL string
	LogLevel    string // debug | info | warn | error

	// Pass-through secrets — empty in MVP skeleton, filled by user later.
	MaimemoToken  string
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OpenAIModel   string
}

// Load reads env vars and returns a populated Config.
//
// All MVP defaults are documented in .env.example at the repo root; keep both
// in sync.
func Load() (Config, error) {
	c := Config{
		AppEnv:        getenv("APP_ENV", "development"),
		AppPort:       getenv("APP_PORT", "8080"),
		DatabaseURL:   getenv("DATABASE_URL", "postgres://lexiforge:lexiforge@localhost:5432/lexiforge?sslmode=disable"),
		LogLevel:      getenv("LOG_LEVEL", "info"),
		MaimemoToken:  os.Getenv("MAIMEMO_TOKEN"),
		OpenAIAPIKey:  os.Getenv("OPENAI_API_KEY"),
		OpenAIBaseURL: getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
		OpenAIModel:   getenv("OPENAI_MODEL", "gpt-4o-mini"),
	}

	if c.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if !strings.HasPrefix(c.AppPort, ":") {
		c.AppPort = ":" + c.AppPort
	}
	return c, nil
}

// IsProduction is the single source of truth for env-conditional behavior
// (e.g. CORS allowlist, debug-mode Gin).
func (c Config) IsProduction() bool {
	return strings.EqualFold(c.AppEnv, "production")
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
