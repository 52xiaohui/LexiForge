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
	Status             string `json:"status"`
	RecordsTotal       int    `json:"records_total"`
	RecordsFetched     int    `json:"records_fetched,omitempty"`
	RecordsUnavailable int    `json:"records_unavailable,omitempty"`
	RecordsInserted    int    `json:"records_inserted"`
	RecordsUpdated     int    `json:"records_updated"`
	DurationMS         int64  `json:"duration_ms"`
	Cached             bool   `json:"cached,omitempty"`
	Warning            string `json:"warning,omitempty"`
}

var ErrTokenMissing = errors.New("maimemo token is missing")

const queryStudyRecordsLimit = 1000

var (
	maimemoTimeZone  = time.FixedZone("CST", 8*60*60)
	minNextStudyDate = time.Date(1900, 1, 1, 0, 0, 0, 0, maimemoTimeZone)
	maxNextStudyDate = time.Date(9999, 12, 31, 23, 59, 59, 0, maimemoTimeZone)
)

func (s *Service) Sync(ctx context.Context) (SyncResult, error) {
	if s.token == "" {
		return SyncResult{}, ErrTokenMissing
	}
	if cached, ok := s.cachedResult(); ok {
		return cached, nil
	}

	start := time.Now()
	totalCount, err := s.queryStudyRecordCount(ctx)
	if err != nil {
		return SyncResult{}, err
	}

	datedCount, err := s.queryDatedStudyRecordCount(ctx)
	if err != nil {
		return SyncResult{}, err
	}

	remoteRecords, unavailable, err := s.fetchAllStudyRecords(ctx, totalCount, datedCount)
	if err != nil {
		return SyncResult{}, err
	}
	now := time.Now()
	records := make([]UpsertStudyRecord, 0, len(remoteRecords))
	for _, remote := range remoteRecords {
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
	total := totalCount
	if total < upserted.RecordsTotal {
		total = upserted.RecordsTotal
	}
	result := SyncResult{
		Status:             "succeeded",
		RecordsTotal:       total,
		RecordsFetched:     upserted.RecordsTotal,
		RecordsUnavailable: unavailable,
		RecordsInserted:    upserted.RecordsInserted,
		RecordsUpdated:     upserted.RecordsUpdated,
		DurationMS:         time.Since(start).Milliseconds(),
	}
	if unavailable > 0 {
		result.Warning = "MaiMemo reports more records than can be paginated by next_study_date; records without next_study_date may be unavailable through the documented sync filters."
	}
	s.storeCachedResult(result)
	return result, nil
}

func (s *Service) queryStudyRecordCount(ctx context.Context) (int, error) {
	resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{AsCount: true})
	if err != nil {
		return 0, err
	}
	return responseCount(resp), nil
}

func (s *Service) queryDatedStudyRecordCount(ctx context.Context) (int, error) {
	resp, err := s.queryStudyRecordRangeCount(ctx, minNextStudyDate, maxNextStudyDate)
	if err != nil {
		return 0, err
	}
	return resp, nil
}

func (s *Service) queryStudyRecordRangeCount(ctx context.Context, start, end time.Time) (int, error) {
	resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{
		AsCount: true,
		NextStudyDate: &StudyDateRange{
			Start: &start,
			End:   &end,
		},
	})
	if err != nil {
		return 0, err
	}
	return responseCount(resp), nil
}

func (s *Service) fetchAllStudyRecords(ctx context.Context, totalCount, datedCount int) ([]StudyRecord, int, error) {
	if totalCount == 0 {
		return nil, 0, nil
	}

	records := make([]StudyRecord, 0, totalCount)
	seen := make(map[string]struct{}, totalCount)
	if datedCount > 0 {
		start, end, err := s.studyDateBounds(ctx, datedCount)
		if err != nil {
			return nil, 0, err
		}
		if err := s.fetchStudyRecordsInDateRange(ctx, start, end, datedCount, &records, seen); err != nil {
			return nil, 0, err
		}
	}

	if len(records) < totalCount {
		resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{Limit: queryStudyRecordsLimit})
		if err != nil {
			return nil, 0, err
		}
		records = appendUniqueStudyRecords(records, seen, resp.Records)
	}

	return records, unavailableRecordCount(totalCount, len(records)), nil
}

func (s *Service) studyDateBounds(ctx context.Context, datedCount int) (time.Time, time.Time, error) {
	if datedCount <= queryStudyRecordsLimit {
		return minNextStudyDate, maxNextStudyDate, nil
	}

	resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{Limit: queryStudyRecordsLimit})
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	start, end, ok := studyDateRangeFromRecords(resp.Records)
	if !ok {
		return minNextStudyDate, maxNextStudyDate, nil
	}
	count, err := s.queryStudyRecordRangeCount(ctx, start, end)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if count == datedCount {
		return start, end, nil
	}
	return minNextStudyDate, maxNextStudyDate, nil
}

func (s *Service) fetchStudyRecordsInDateRange(ctx context.Context, start, end time.Time, expected int, records *[]StudyRecord, seen map[string]struct{}) error {
	if expected <= 0 {
		return nil
	}
	if expected <= queryStudyRecordsLimit {
		resp, err := s.client.QueryStudyRecords(ctx, s.token, QueryStudyRecordsRequest{
			Limit: queryStudyRecordsLimit,
			NextStudyDate: &StudyDateRange{
				Start: &start,
				End:   &end,
			},
		})
		if err != nil {
			return err
		}
		*records = appendUniqueStudyRecords(*records, seen, resp.Records)
		return nil
	}

	leftEnd, rightStart, ok := splitStudyDateRange(start, end)
	if !ok {
		return fmt.Errorf("maimemo full sync cannot paginate: more than %d records share date range %s..%s", queryStudyRecordsLimit, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	}
	leftCount, err := s.queryStudyRecordRangeCount(ctx, start, leftEnd)
	if err != nil {
		return err
	}
	if err := s.fetchStudyRecordsInDateRange(ctx, start, leftEnd, leftCount, records, seen); err != nil {
		return err
	}
	rightCount := expected - leftCount
	if rightCount < 0 {
		rightCount = 0
	}
	return s.fetchStudyRecordsInDateRange(ctx, rightStart, end, rightCount, records, seen)
}

func responseCount(resp *QueryStudyRecordsResponse) int {
	if resp == nil {
		return 0
	}
	if resp.Count > 0 {
		return resp.Count
	}
	return resp.TotalCount
}

func unavailableRecordCount(totalCount, fetched int) int {
	if totalCount <= fetched {
		return 0
	}
	return totalCount - fetched
}

func appendUniqueStudyRecords(dst []StudyRecord, seen map[string]struct{}, src []StudyRecord) []StudyRecord {
	for _, record := range src {
		key := record.VocID
		if key == "" {
			key = record.VocSpelling
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		dst = append(dst, record)
	}
	return dst
}

func studyDateRangeFromRecords(records []StudyRecord) (time.Time, time.Time, bool) {
	var start, end time.Time
	for _, record := range records {
		if record.NextStudyDate == nil {
			continue
		}
		if start.IsZero() || record.NextStudyDate.Before(start) {
			start = *record.NextStudyDate
		}
		if end.IsZero() || record.NextStudyDate.After(end) {
			end = *record.NextStudyDate
		}
	}
	if start.IsZero() || end.IsZero() {
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}

func splitStudyDateRange(start, end time.Time) (time.Time, time.Time, bool) {
	if !end.After(start) {
		return time.Time{}, time.Time{}, false
	}
	startSec := start.Unix()
	endSec := end.Unix()
	var leftEnd time.Time
	if endSec > startSec {
		midSec := startSec + (endSec-startSec)/2
		leftEnd = time.Unix(midSec, 0).In(start.Location())
	} else {
		leftEnd = start.Add(end.Sub(start) / 2)
	}
	if !leftEnd.After(start) {
		leftEnd = start
	}
	rightStart := leftEnd.Add(time.Nanosecond)
	if rightStart.After(end) {
		return time.Time{}, time.Time{}, false
	}
	return leftEnd, rightStart, true
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
