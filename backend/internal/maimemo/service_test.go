package maimemo

import (
	"context"
	"fmt"
	"testing"
	"time"
)

type fakeClient struct {
	requests []QueryStudyRecordsRequest
	resps    []*QueryStudyRecordsResponse
	err      error
	handler  func(QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error)
}

func (f *fakeClient) GetStudyProgress(context.Context, string) (*StudyProgress, error) {
	return nil, nil
}

func (f *fakeClient) QueryStudyRecords(_ context.Context, _ string, req QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error) {
	f.requests = append(f.requests, req)
	if f.err != nil {
		return nil, f.err
	}
	if f.handler != nil {
		return f.handler(req)
	}
	if len(f.resps) == 0 {
		return &QueryStudyRecordsResponse{}, nil
	}
	resp := f.resps[0]
	f.resps = f.resps[1:]
	return resp, nil
}

func (f *fakeClient) GetTodayItems(context.Context, string, GetTodayItemsRequest) (*GetTodayItemsResponse, error) {
	return nil, nil
}

type fakeSyncRepo struct {
	records []UpsertStudyRecord
}

func (f *fakeSyncRepo) UpsertStudyRecords(records []UpsertStudyRecord) (UpsertResult, error) {
	f.records = records
	return UpsertResult{RecordsTotal: len(records), RecordsInserted: len(records)}, nil
}

func (f *fakeSyncRepo) LatestSync() (LatestSync, error) {
	return LatestSync{Status: "succeeded"}, nil
}

func newStudyRecordRangeClient(records []StudyRecord) *fakeClient {
	return &fakeClient{handler: func(req QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error) {
		filtered := make([]StudyRecord, 0, len(records))
		for _, record := range records {
			if !studyRecordMatchesRange(record, req.NextStudyDate) {
				continue
			}
			filtered = append(filtered, record)
		}
		if req.AsCount {
			return &QueryStudyRecordsResponse{Count: len(filtered)}, nil
		}
		if req.Limit > 0 && len(filtered) > req.Limit {
			filtered = filtered[:req.Limit]
		}
		return &QueryStudyRecordsResponse{Records: filtered}, nil
	}}
}

func studyRecordMatchesRange(record StudyRecord, dateRange *StudyDateRange) bool {
	if dateRange == nil {
		return true
	}
	if record.NextStudyDate == nil {
		return false
	}
	if dateRange.Start != nil && record.NextStudyDate.Before(*dateRange.Start) {
		return false
	}
	if dateRange.End != nil && record.NextStudyDate.After(*dateRange.End) {
		return false
	}
	return true
}

func TestServiceSyncMapsAndCachesRecords(t *testing.T) {
	next := time.Now()
	client := &fakeClient{resps: []*QueryStudyRecordsResponse{
		{Count: 1},
		{Count: 1},
		{Records: []StudyRecord{{
			VocID:         "voc-1",
			VocSpelling:   "competent",
			LastResponse:  "FORGET",
			StudyCount:    14,
			Tags:          []string{"STICKING"},
			NextStudyDate: &next,
		}}},
	}}
	repo := &fakeSyncRepo{}
	svc := NewService(repo, client, "secret-token")

	first, err := svc.Sync(context.Background())
	if err != nil {
		t.Fatalf("first Sync returned error: %v", err)
	}
	second, err := svc.Sync(context.Background())
	if err != nil {
		t.Fatalf("second Sync returned error: %v", err)
	}

	if len(client.requests) != 3 {
		t.Fatalf("client calls = %d, want count + first page due to debounce cache", len(client.requests))
	}
	if !client.requests[0].AsCount {
		t.Fatalf("first request AsCount = false, want true")
	}
	if !client.requests[1].AsCount || client.requests[1].NextStudyDate == nil || client.requests[1].NextStudyDate.End == nil {
		t.Fatalf("second request = %#v, want dated count", client.requests[1])
	}
	if !second.Cached {
		t.Fatalf("second result Cached = false, want true")
	}
	if first.RecordsInserted != 1 || len(repo.records) != 1 {
		t.Fatalf("sync result = %#v records=%#v, want one inserted record", first, repo.records)
	}
	record := repo.records[0]
	if record.Provider != "maimemo" || record.ProviderVocID != "voc-1" {
		t.Fatalf("mapped record key = %s/%s, want maimemo/voc-1", record.Provider, record.ProviderVocID)
	}
	if record.MasteryScore != 0 || record.WeakScore < 180 {
		t.Fatalf("scores = mastery %d weak %d, want scored weak record", record.MasteryScore, record.WeakScore)
	}
}

func TestServiceSyncPaginatesBeyondLimit(t *testing.T) {
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	records := make([]StudyRecord, 0, queryStudyRecordsLimit+1)
	for i := 0; i < queryStudyRecordsLimit+1; i++ {
		next := base.AddDate(0, 0, i)
		records = append(records, StudyRecord{
			VocID:         fmt.Sprintf("voc-%04d", i),
			VocSpelling:   fmt.Sprintf("word-%04d", i),
			LastResponse:  "FAMILIAR",
			StudyCount:    1,
			NextStudyDate: &next,
		})
	}
	client := newStudyRecordRangeClient(records)
	repo := &fakeSyncRepo{}
	svc := NewService(repo, client, "secret-token")

	result, err := svc.Sync(context.Background())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	if result.RecordsTotal != queryStudyRecordsLimit+1 || len(repo.records) != queryStudyRecordsLimit+1 {
		t.Fatalf("result = %#v records=%d, want %d unique records", result, len(repo.records), queryStudyRecordsLimit+1)
	}
	if result.RecordsUnavailable != 0 || result.Warning != "" {
		t.Fatalf("result = %#v, want complete date pagination without warning", result)
	}
}

func TestServiceSyncAllowsRecordsUnavailableThroughDatePagination(t *testing.T) {
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	records := make([]StudyRecord, 0, 1079)
	for i := 0; i < 1009; i++ {
		next := base.AddDate(0, 0, i)
		records = append(records, StudyRecord{
			VocID:         fmt.Sprintf("voc-%04d", i),
			VocSpelling:   fmt.Sprintf("word-%04d", i),
			LastResponse:  "FAMILIAR",
			StudyCount:    1,
			NextStudyDate: &next,
		})
	}
	for i := 0; i < 70; i++ {
		records = append(records, StudyRecord{
			VocID:        fmt.Sprintf("voc-undated-%02d", i),
			VocSpelling:  fmt.Sprintf("undated-%02d", i),
			LastResponse: "VAGUE",
			StudyCount:   2,
		})
	}
	client := newStudyRecordRangeClient(records)
	repo := &fakeSyncRepo{}
	svc := NewService(repo, client, "secret-token")

	result, err := svc.Sync(context.Background())
	if err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}
	if result.RecordsTotal != 1079 || result.RecordsFetched != 1009 || result.RecordsUnavailable != 70 {
		t.Fatalf("result = %#v, want total 1079 fetched 1009 unavailable 70", result)
	}
	if result.Warning == "" {
		t.Fatalf("Warning is empty, want unavailable records warning")
	}
}
