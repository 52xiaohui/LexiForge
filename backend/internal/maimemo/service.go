package maimemo

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"lexiforge/backend/internal/vocabulary"
)

// Service runs the sync flow: pull from MaiMemo client, score, upsert via
// repo.
type Service struct {
	repo   syncRepository
	client Client
	token  string

	mu             sync.Mutex
	lastSyncAt     time.Time
	lastSyncResult *SyncResult
}

// NewService is the canonical constructor.
func NewService(repo syncRepository, client Client, token string) *Service {
	return &Service{repo: repo, client: client, token: token}
}

type syncRepository interface {
	UpsertStudyRecords(records []UpsertStudyRecord) (UpsertResult, error)
	LatestSync() (LatestSync, error)
}

type SyncResult struct {
	Status          string `json:"status"`
	RecordsTotal    int    `json:"records_total"`
	RecordsInserted int    `json:"records_inserted"`
	RecordsUpdated  int    `json:"records_updated"`
	DurationMS      int64  `json:"duration_ms"`
	Cached          bool   `json:"cached,omitempty"`
}

var ErrTokenMissing = errors.New("maimemo token is missing")

func (s *Service) Sync(ctx context.Context) (SyncResult, error) {
	if s.token == "" {
		return SyncResult{}, ErrTokenMissing
	}
	if cached, ok := s.cachedResult(); ok {
		return cached, nil
	}

	start := time.Now()
	resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{Limit: 1000})
	if err != nil {
		return SyncResult{}, err
	}

	now := time.Now()
	records := make([]UpsertStudyRecord, 0, len(resp.Records))
	for _, remote := range resp.Records {
		local, err := mapStudyRecord(remote, now)
		if err != nil {
			return SyncResult{}, err
		}
		records = append(records, local)
	}

	upserted, err := s.repo.UpsertStudyRecords(records)
	if err != nil {
		return SyncResult{}, err
	}
	total := upserted.RecordsTotal
	if resp.TotalCount > total {
		total = resp.TotalCount
	}
	result := SyncResult{
		Status:          "succeeded",
		RecordsTotal:    total,
		RecordsInserted: upserted.RecordsInserted,
		RecordsUpdated:  upserted.RecordsUpdated,
		DurationMS:      time.Since(start).Milliseconds(),
	}
	s.storeCachedResult(result)
	return result, nil
}

func (s *Service) LatestSync() (LatestSync, error) {
	return s.repo.LatestSync()
}

func (s *Service) cachedResult() (SyncResult, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastSyncResult == nil || time.Since(s.lastSyncAt) > 5*time.Second {
		return SyncResult{}, false
	}
	result := *s.lastSyncResult
	result.Cached = true
	return result, true
}

func (s *Service) storeCachedResult(result SyncResult) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastSyncAt = time.Now()
	s.lastSyncResult = &result
}

func mapStudyRecord(remote StudyRecord, now time.Time) (UpsertStudyRecord, error) {
	response := vocabulary.NormalizeLastResponse(remote.LastResponse)
	score := vocabulary.CalculateScore(vocabulary.ScoreInput{
		LastResponse:  response,
		StudyCount:    remote.StudyCount,
		Tags:          remote.Tags,
		NextStudyDate: remote.NextStudyDate,
	}, now)
	providerVocID := remote.VocID
	spelling := remote.VocSpelling
	if providerVocID == "" || spelling == "" {
		return UpsertStudyRecord{}, fmt.Errorf("maimemo record missing voc_id or voc_spelling")
	}
	return UpsertStudyRecord{
		Provider:       "maimemo",
		ProviderVocID:  providerVocID,
		Spelling:       spelling,
		LastResponse:   response,
		StudyCount:     remote.StudyCount,
		Tags:           remote.Tags,
		AddDate:        remote.AddDate,
		FirstStudyDate: remote.FirstStudyDate,
		LastStudyDate:  remote.LastStudyDate,
		NextStudyDate:  remote.NextStudyDate,
		MasteryScore:   score.MasteryScore,
		WeakScore:      score.WeakScore,
		ScoreVersion:   vocabulary.ScoreVersionV1,
		ScoreReasons:   score.Reasons,
		ScoredAt:       now,
		SyncedAt:       now,
		RawPayload:     remote,
	}, nil
}
