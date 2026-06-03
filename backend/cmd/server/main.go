// Command server is the HTTP entrypoint for the LexiForge backend.
//
// Boot sequence:
//  1. load config from env
//  2. initialize structured logger
//  3. open Postgres + run migrations + seed local-user
//  4. wire domain modules (handler/service/repository) and external clients
//  5. start Gin with cors / logger / recover middleware
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"lexiforge/backend/internal/ai"
	"lexiforge/backend/internal/article"
	"lexiforge/backend/internal/config"
	"lexiforge/backend/internal/database"
	"lexiforge/backend/internal/dictionary"
	"lexiforge/backend/internal/export"
	"lexiforge/backend/internal/maimemo"
	"lexiforge/backend/internal/middleware"
	"lexiforge/backend/internal/vocabulary"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "error", err)
		os.Exit(1)
	}

	initLogger(cfg)

	db, err := database.Open(cfg)
	if err != nil {
		slog.Error("database open failed", "error", err)
		os.Exit(1)
	}
	if err := database.RunMigrations(db); err != nil {
		slog.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	maimemoClient := maimemo.NewHTTPClient("")
	aiClient := ai.NewOpenAIClient(cfg)

	r := buildRouter(cfg, db, maimemoClient, aiClient)

	slog.Info("starting http server", "addr", cfg.AppPort, "env", cfg.AppEnv)
	if err := r.Run(cfg.AppPort); err != nil {
		slog.Error("http server stopped", "error", err)
		os.Exit(1)
	}
}

// initLogger configures slog's default handler. Production uses JSON; dev
// uses the text handler for human readability.
func initLogger(cfg config.Config) {
	level := parseLogLevel(cfg.LogLevel)
	opts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	if cfg.IsProduction() {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	slog.SetDefault(slog.New(handler))
}

func parseLogLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// buildRouter wires Gin: middleware, /healthz, and the /api/v1 group.
//
// Each domain's NewModule pulls its own repo and service from the shared DB.
func buildRouter(cfg config.Config, db *gorm.DB, mmClient maimemo.Client, aiClient ai.Client) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recover(), middleware.Logger(), middleware.CORS(cfg))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")

	vocabulary.NewModule(db).Register(api)
	dictionary.NewModule(db).Register(api)
	article.NewModule(db, aiClient).Register(api)
	maimemo.NewModule(db, mmClient, cfg.MaimemoToken).Register(api)
	export.NewModule(db).Register(api)

	return r
}
