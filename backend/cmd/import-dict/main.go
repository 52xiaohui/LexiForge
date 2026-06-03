package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"lexiforge/backend/internal/config"
	"lexiforge/backend/internal/database"
	"lexiforge/backend/internal/dictionary"
)

func main() {
	sourcePath := flag.String("source", "", "path to a kajweb/dict JSON file or directory")
	sourceName := flag.String("source-name", dictionary.SourceKajwebDict, "dictionary source name")
	flag.Parse()

	if *sourcePath == "" {
		fmt.Fprintln(os.Stderr, "-source is required")
		os.Exit(2)
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "error", err)
		os.Exit(1)
	}
	db, err := database.Open(cfg)
	if err != nil {
		slog.Error("database open failed", "error", err)
		os.Exit(1)
	}
	if err := database.RunMigrations(db); err != nil {
		slog.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	importer := dictionary.NewImporter(dictionary.NewRepository(db), *sourceName)
	result, err := importer.ImportPath(ctx, *sourcePath)
	if err != nil {
		slog.Error("dictionary import failed", "error", err)
		os.Exit(1)
	}
	slog.Info("dictionary import completed",
		"files_processed", result.FilesProcessed,
		"entries_upserted", result.EntriesUpserted,
		"entries_skipped", result.EntriesSkipped,
	)
}
