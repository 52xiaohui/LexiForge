// Package config loads runtime configuration from the process environment and
// the optional project root .env file.
//
// Defaults target a local developer database. Real secrets (MAIMEMO_TOKEN,
// OPENAI_API_KEY, ...) are never given a non-empty default; they must come from
// the environment or .env.
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// Config is the canonical runtime config snapshot. main.go calls Load once
// at startup and passes the value down by reference.
type Config struct {
	AppEnv      string // development | production
	AppPort     string // ":8080"-style port
	DatabaseURL string
	LogLevel    string // debug | info | warn | error

	CORSAllowedOrigins  []string
	AppAccessToken      string
	AIRateLimitPerMin   int
	SyncRateLimitPerMin int

	// Pass-through secrets: empty until filled by env or .env.
	MaimemoToken  string
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OpenAIModel   string
}

// Load reads an optional project root .env file, overlays process environment
// values, and returns a populated Config.
//
// Process environment values take precedence so Docker / PaaS deployments can
// use native env configuration. All MVP defaults are documented in .env.example
// at the repo root; keep both in sync.
func Load() (Config, error) {
	values := make(map[string]string)
	if envPath, err := findEnvFile(); err == nil {
		fileValues, err := readEnvFile(envPath)
		if err != nil {
			return Config{}, err
		}
		mergeValues(values, fileValues)
	}
	mergeValues(values, readProcessEnv())
	return loadFromValues(values)
}

func loadFromFile(path string) (Config, error) {
	values, err := readEnvFile(path)
	if err != nil {
		return Config{}, err
	}
	return loadFromValues(values)
}

func loadFromValues(values map[string]string) (Config, error) {
	c := Config{
		AppEnv:             envValue(values, "APP_ENV", "development"),
		AppPort:            envValue(values, "APP_PORT", "8080"),
		DatabaseURL:        envValue(values, "DATABASE_URL", "postgres://lexiforge:lexiforge@localhost:5432/lexiforge?sslmode=disable"),
		LogLevel:           envValue(values, "LOG_LEVEL", "info"),
		CORSAllowedOrigins: parseCSVList(values["CORS_ALLOWED_ORIGINS"]),
		AppAccessToken:     strings.TrimSpace(values["APP_ACCESS_TOKEN"]),
		MaimemoToken:       values["MAIMEMO_TOKEN"],
		OpenAIAPIKey:       values["OPENAI_API_KEY"],
		OpenAIBaseURL:      envValue(values, "OPENAI_BASE_URL", "https://api.openai.com/v1"),
		OpenAIModel:        envValue(values, "OPENAI_MODEL", "gpt-4o-mini"),
	}
	var err error
	c.AIRateLimitPerMin, err = positiveIntValue(values, "AI_RATE_LIMIT_PER_MINUTE", 5)
	if err != nil {
		return Config{}, err
	}
	c.SyncRateLimitPerMin, err = positiveIntValue(values, "SYNC_RATE_LIMIT_PER_MINUTE", 2)
	if err != nil {
		return Config{}, err
	}

	if c.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if c.IsProduction() && len(c.AppAccessToken) < 32 {
		return Config{}, fmt.Errorf("APP_ACCESS_TOKEN must contain at least 32 characters in production")
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

func envValue(values map[string]string, key, fallback string) string {
	if v := values[key]; v != "" {
		return v
	}
	return fallback
}

func mergeValues(dst, src map[string]string) {
	for key, value := range src {
		dst[key] = value
	}
}

func readProcessEnv() map[string]string {
	values := make(map[string]string)
	for _, key := range []string{
		"APP_ENV",
		"APP_PORT",
		"DATABASE_URL",
		"LOG_LEVEL",
		"CORS_ALLOWED_ORIGINS",
		"APP_ACCESS_TOKEN",
		"AI_RATE_LIMIT_PER_MINUTE",
		"SYNC_RATE_LIMIT_PER_MINUTE",
		"MAIMEMO_TOKEN",
		"OPENAI_API_KEY",
		"OPENAI_BASE_URL",
		"OPENAI_MODEL",
	} {
		if value := os.Getenv(key); value != "" {
			values[key] = value
		}
	}
	return values
}

func positiveIntValue(values map[string]string, key string, fallback int) (int, error) {
	raw := strings.TrimSpace(values[key])
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	return value, nil
}

func parseCSVList(value string) []string {
	if value == "" {
		return nil
	}
	var items []string
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		item = strings.TrimRight(item, "/")
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func findEnvFile() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get working directory: %w", err)
	}
	if root, ok := findProjectRootFromDir(dir); ok {
		path := filepath.Join(root, ".env")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		return "", fmt.Errorf("project root .env not found at %s", path)
	}
	path := filepath.Join(dir, ".env")
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}
	if root, ok := sourceProjectRoot(); ok {
		path := filepath.Join(root, ".env")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("project root .env not found")
}

func sourceProjectRoot() (string, bool) {
	_, file, _, ok := runtime.Caller(0)
	if !ok || !filepath.IsAbs(file) {
		return "", false
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", ".."))
	if isProjectRoot(root) {
		return root, true
	}
	return "", false
}

func findProjectRootFromDir(dir string) (string, bool) {
	for {
		if isProjectRoot(dir) {
			return dir, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

func isProjectRoot(dir string) bool {
	if _, err := os.Stat(filepath.Join(dir, ".env.example")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(dir, "backend", "go.mod")); err != nil {
		return false
	}
	return true
}

func readEnvFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open .env: %w", err)
	}
	defer file.Close()

	values := make(map[string]string)
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("parse .env line %d: missing =", lineNumber)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return nil, fmt.Errorf("parse .env line %d: missing key", lineNumber)
		}
		values[key] = parseEnvValue(strings.TrimSpace(value))
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read .env: %w", err)
	}
	return values, nil
}

func parseEnvValue(value string) string {
	if len(value) == 0 {
		return ""
	}
	first := value[0]
	if first == '"' || first == '\'' {
		for i := 1; i < len(value); i++ {
			if value[i] == first {
				return value[1:i]
			}
		}
	}
	if index := strings.Index(value, " #"); index >= 0 {
		value = strings.TrimSpace(value[:index])
	}
	return value
}
