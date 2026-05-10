package maimemo

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"lexiforge/backend/internal/config"
	"lexiforge/backend/internal/database"
	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

func TestRepositoryBatchUpsertStudyRecordsPostgres(t *testing.T) {
	db := openMaimemoIntegrationDB(t)
	repo := NewRepository(db)
	now := time.Now().UTC().Truncate(time.Second)
	next := now.AddDate(0, 0, 7)
	records := make([]UpsertStudyRecord, 0, 1501)
	for i := 0; i < 1501; i++ {
		records = append(records, UpsertStudyRecord{
			Provider:      "maimemo",
			ProviderVocID: fmt.Sprintf("voc-%04d", i),
			Spelling:      fmt.Sprintf("word-%04d", i),
			LastResponse:  "FAMILIAR",
			StudyCount:    i,
			Tags:          []string{"WELL_FAMILIAR"},
			NextStudyDate: &next,
			MasteryScore:  75,
			WeakScore:     20,
			ScoreVersion:  vocabulary.ScoreVersionV1,
			ScoreReasons:  map[string]int{"mastery_base_FAMILIAR": 75},
			ScoredAt:      now,
			SyncedAt:      now,
			RawPayload:    map[string]any{"voc_id": fmt.Sprintf("voc-%04d", i)},
		})
	}

	first, err := repo.UpsertStudyRecords(records)
	if err != nil {
		t.Fatalf("first UpsertStudyRecords returned error: %v", err)
	}
	if first.RecordsTotal != 1501 || first.RecordsInserted != 1501 || first.RecordsUpdated != 0 {
		t.Fatalf("first result = %#v, want 1501 inserted", first)
	}

	records[0].Spelling = "updated-word"
	records[0].LastResponse = "FORGET"
	records[0].NextStudyDate = nil
	records[0].MasteryScore = 20
	records[0].WeakScore = 100
	second, err := repo.UpsertStudyRecords(records)
	if err != nil {
		t.Fatalf("second UpsertStudyRecords returned error: %v", err)
	}
	if second.RecordsTotal != 1501 || second.RecordsInserted != 0 || second.RecordsUpdated != 1501 {
		t.Fatalf("second result = %#v, want 1501 updated", second)
	}

	var wordCount int64
	if err := db.Model(&vocabulary.VocabWord{}).Count(&wordCount).Error; err != nil {
		t.Fatalf("count vocab words: %v", err)
	}
	if wordCount != 1501 {
		t.Fatalf("vocab word count = %d, want 1501", wordCount)
	}
	var recordCount int64
	if err := db.Model(&vocabulary.StudyRecord{}).Count(&recordCount).Error; err != nil {
		t.Fatalf("count study records: %v", err)
	}
	if recordCount != 1501 {
		t.Fatalf("study record count = %d, want 1501", recordCount)
	}

	var stored vocabulary.StudyRecord
	if err := db.Where("provider = ? AND provider_voc_id = ?", "maimemo", "voc-0000").First(&stored).Error; err != nil {
		t.Fatalf("load updated record: %v", err)
	}
	if stored.LastResponse != "FORGET" || stored.NextStudyDate != nil || stored.WeakScore != 100 {
		t.Fatalf("updated record = %#v, want nil next_study_date and updated scores", stored)
	}
	var storedWord vocabulary.VocabWord
	if err := db.Where("provider = ? AND provider_voc_id = ?", "maimemo", "voc-0000").First(&storedWord).Error; err != nil {
		t.Fatalf("load updated word: %v", err)
	}
	if storedWord.Spelling != "updated-word" {
		t.Fatalf("word spelling = %q, want updated-word", storedWord.Spelling)
	}
}

func openMaimemoIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LEXIFORGE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set LEXIFORGE_TEST_DATABASE_URL to run Postgres integration tests")
	}

	db, err := database.Open(config.Config{
		AppEnv:      "test",
		DatabaseURL: dsn,
		LogLevel:    "warn",
	})
	if err != nil {
		t.Skipf("Postgres integration database unavailable: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("acquire sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	schema := "lexiforge_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := db.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatalf("create test schema: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Exec("SET search_path TO public").Error
		_ = db.Exec("DROP SCHEMA IF EXISTS " + schema + " CASCADE").Error
		_ = sqlDB.Close()
	})

	if err := db.Exec("SET search_path TO " + schema).Error; err != nil {
		t.Fatalf("set search_path: %v", err)
	}
	if err := database.RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	var count int64
	if err := db.Model(&user.User{}).Where("id = ?", user.LocalUserID).Count(&count).Error; err != nil {
		t.Fatalf("count local user: %v", err)
	}
	if count != 1 {
		t.Fatalf("local user count = %d, want 1", count)
	}
	return db
}
