package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFromFileReadsDotEnv(t *testing.T) {
	path := writeEnvFile(t, `
APP_ENV=production
APP_PORT=9090
DATABASE_URL=postgres://custom
LOG_LEVEL=debug
MAIMEMO_TOKEN=maimemo-token
OPENAI_API_KEY=openai-key
OPENAI_BASE_URL="http://ai.test/v1"
OPENAI_MODEL='gpt-test'
CORS_ALLOWED_ORIGINS=https://app.example.com, https://preview.example.com/
APP_ACCESS_TOKEN=0123456789abcdef0123456789abcdef
AI_RATE_LIMIT_PER_MINUTE=7
SYNC_RATE_LIMIT_PER_MINUTE=3
`)

	cfg, err := loadFromFile(path)
	if err != nil {
		t.Fatalf("loadFromFile returned error: %v", err)
	}
	if cfg.AppEnv != "production" {
		t.Fatalf("AppEnv = %q, want production", cfg.AppEnv)
	}
	if cfg.AppPort != ":9090" {
		t.Fatalf("AppPort = %q, want :9090", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://custom" {
		t.Fatalf("DatabaseURL = %q, want postgres://custom", cfg.DatabaseURL)
	}
	if cfg.LogLevel != "debug" {
		t.Fatalf("LogLevel = %q, want debug", cfg.LogLevel)
	}
	if cfg.MaimemoToken != "maimemo-token" {
		t.Fatalf("MaimemoToken = %q, want maimemo-token", cfg.MaimemoToken)
	}
	if cfg.OpenAIAPIKey != "openai-key" {
		t.Fatalf("OpenAIAPIKey = %q, want openai-key", cfg.OpenAIAPIKey)
	}
	if cfg.OpenAIBaseURL != "http://ai.test/v1" {
		t.Fatalf("OpenAIBaseURL = %q, want http://ai.test/v1", cfg.OpenAIBaseURL)
	}
	if cfg.OpenAIModel != "gpt-test" {
		t.Fatalf("OpenAIModel = %q, want gpt-test", cfg.OpenAIModel)
	}
	assertStringSlice(t, cfg.CORSAllowedOrigins, []string{
		"https://app.example.com",
		"https://preview.example.com",
	})
	if cfg.AppAccessToken != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("AppAccessToken was not loaded")
	}
	if cfg.AIRateLimitPerMin != 7 || cfg.SyncRateLimitPerMin != 3 {
		t.Fatalf("rate limits = %d/%d, want 7/3", cfg.AIRateLimitPerMin, cfg.SyncRateLimitPerMin)
	}
}

func TestLoadFromFileIgnoresProcessEnvironment(t *testing.T) {
	t.Setenv("APP_PORT", "9999")
	t.Setenv("DATABASE_URL", "postgres://terminal")

	path := writeEnvFile(t, `
APP_PORT=8081
DATABASE_URL=postgres://file
`)

	cfg, err := loadFromFile(path)
	if err != nil {
		t.Fatalf("loadFromFile returned error: %v", err)
	}
	if cfg.AppPort != ":8081" {
		t.Fatalf("AppPort = %q, want :8081", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://file" {
		t.Fatalf("DatabaseURL = %q, want postgres://file", cfg.DatabaseURL)
	}
}

func TestLoadFromFileAppliesDefaults(t *testing.T) {
	cfg, err := loadFromFile(writeEnvFile(t, ""))
	if err != nil {
		t.Fatalf("loadFromFile returned error: %v", err)
	}
	if cfg.AppEnv != "development" {
		t.Fatalf("AppEnv = %q, want development", cfg.AppEnv)
	}
	if cfg.AppPort != ":8080" {
		t.Fatalf("AppPort = %q, want :8080", cfg.AppPort)
	}
	if cfg.DatabaseURL == "" {
		t.Fatalf("DatabaseURL is empty, want default")
	}
	if cfg.OpenAIBaseURL != "https://api.openai.com/v1" {
		t.Fatalf("OpenAIBaseURL = %q, want default", cfg.OpenAIBaseURL)
	}
	if cfg.OpenAIModel != "gpt-4o-mini" {
		t.Fatalf("OpenAIModel = %q, want default", cfg.OpenAIModel)
	}
	if cfg.AIRateLimitPerMin != 5 || cfg.SyncRateLimitPerMin != 2 {
		t.Fatalf("default rate limits = %d/%d, want 5/2", cfg.AIRateLimitPerMin, cfg.SyncRateLimitPerMin)
	}
}

func TestLoadFindsProjectRootDotEnv(t *testing.T) {
	clearConfigEnv(t)
	root := createProjectRoot(t)
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("APP_PORT=7070\nDATABASE_URL=postgres://root-file\n"), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}
	chdir(t, filepath.Join(root, "backend", "internal", "config"))

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.AppPort != ":7070" {
		t.Fatalf("AppPort = %q, want :7070", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://root-file" {
		t.Fatalf("DatabaseURL = %q, want postgres://root-file", cfg.DatabaseURL)
	}
}

func TestLoadUsesProcessEnvironmentWithoutDotEnv(t *testing.T) {
	clearConfigEnv(t)
	root := createProjectRoot(t)
	chdir(t, filepath.Join(root, "backend", "internal", "config"))
	t.Setenv("APP_ENV", "production")
	t.Setenv("APP_PORT", "6060")
	t.Setenv("DATABASE_URL", "postgres://env-only")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://api.example.com/")
	t.Setenv("APP_ACCESS_TOKEN", "0123456789abcdef0123456789abcdef")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.AppEnv != "production" {
		t.Fatalf("AppEnv = %q, want production", cfg.AppEnv)
	}
	if cfg.AppPort != ":6060" {
		t.Fatalf("AppPort = %q, want :6060", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://env-only" {
		t.Fatalf("DatabaseURL = %q, want postgres://env-only", cfg.DatabaseURL)
	}
	assertStringSlice(t, cfg.CORSAllowedOrigins, []string{
		"https://app.example.com",
		"https://api.example.com",
	})
}

func TestProductionRequiresStrongAccessToken(t *testing.T) {
	_, err := loadFromFile(writeEnvFile(t, `
APP_ENV=production
DATABASE_URL=postgres://production
`))
	if err == nil {
		t.Fatalf("loadFromFile returned nil error, want production access-token validation")
	}
}

func TestRateLimitMustBePositiveInteger(t *testing.T) {
	_, err := loadFromFile(writeEnvFile(t, `
AI_RATE_LIMIT_PER_MINUTE=0
`))
	if err == nil {
		t.Fatalf("loadFromFile returned nil error, want invalid rate-limit validation")
	}
}

func TestLoadProcessEnvironmentOverridesDotEnv(t *testing.T) {
	clearConfigEnv(t)
	root := createProjectRoot(t)
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("APP_PORT=7070\nDATABASE_URL=postgres://file\n"), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}
	chdir(t, filepath.Join(root, "backend", "internal", "config"))
	t.Setenv("APP_PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://env")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.AppPort != ":9090" {
		t.Fatalf("AppPort = %q, want :9090", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://env" {
		t.Fatalf("DatabaseURL = %q, want postgres://env", cfg.DatabaseURL)
	}
}

func TestFindProjectRootFromDir(t *testing.T) {
	root := createProjectRoot(t)
	backendDir := filepath.Join(root, "backend")

	got, ok := findProjectRootFromDir(filepath.Join(backendDir, "internal", "config"))
	if !ok {
		t.Fatalf("findProjectRootFromDir did not find project root")
	}
	if got != root {
		t.Fatalf("root = %q, want %q", got, root)
	}
}

func createProjectRoot(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env.example"), nil, 0o600); err != nil {
		t.Fatalf("write .env.example: %v", err)
	}
	backendDir := filepath.Join(root, "backend")
	if err := os.MkdirAll(filepath.Join(backendDir, "internal", "config"), 0o700); err != nil {
		t.Fatalf("mkdir backend tree: %v", err)
	}
	if err := os.WriteFile(filepath.Join(backendDir, "go.mod"), nil, 0o600); err != nil {
		t.Fatalf("write go.mod: %v", err)
	}
	return root
}

func chdir(t *testing.T, dir string) {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(cwd); err != nil {
			t.Fatalf("restore working directory: %v", err)
		}
	})
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
}

func clearConfigEnv(t *testing.T) {
	t.Helper()

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
		t.Setenv(key, "")
	}
}

func assertStringSlice(t *testing.T, got, want []string) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("slice len = %d (%v), want %d (%v)", len(got), got, len(want), want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("slice[%d] = %q, want %q (got %v, want %v)", i, got[i], want[i], got, want)
		}
	}
}

func writeEnvFile(t *testing.T, content string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}
	return path
}
