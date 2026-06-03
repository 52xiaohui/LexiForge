// Package config loads runtime configuration from the project root .env file.
//
// Defaults target a local developer database. Real secrets (MAIMEMO_TOKEN,
// OPENAI_API_KEY, ...) are never given a non-empty default; they must come from
// .env.
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// Config is the canonical runtime config snapshot. main.go calls Load once
// at startup and passes the value down by reference.
type Config struct {
	AppEnv      string // development | production
	AppPort     string // ":8080"-style port
	DatabaseURL string
	LogLevel    string // debug | info | warn | error

	// Pass-through secrets: empty until filled by the user's .env.
	MaimemoToken  string
	OpenAIAPIKey  string
	OpenAIBaseURL string
	OpenAIModel   string
}

// Load reads the project root .env file and returns a populated Config.
//
// All MVP defaults are documented in .env.example at the repo root; keep both
// in sync.
func Load() (Config, error) {
	envPath, err := findEnvFile()
	if err != nil {
		return Config{}, err
	}
	return loadFromFile(envPath)
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
		AppEnv:        envValue(values, "APP_ENV", "development"),
		AppPort:       envValue(values, "APP_PORT", "8080"),
		DatabaseURL:   envValue(values, "DATABASE_URL", "postgres://lexiforge:lexiforge@localhost:5432/lexiforge?sslmode=disable"),
		LogLevel:      envValue(values, "LOG_LEVEL", "info"),
		MaimemoToken:  values["MAIMEMO_TOKEN"],
		OpenAIAPIKey:  values["OPENAI_API_KEY"],
		OpenAIBaseURL: envValue(values, "OPENAI_BASE_URL", "https://api.openai.com/v1"),
		OpenAIModel:   envValue(values, "OPENAI_MODEL", "gpt-4o-mini"),
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

func envValue(values map[string]string, key, fallback string) string {
	if v := values[key]; v != "" {
		return v
	}
	return fallback
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
