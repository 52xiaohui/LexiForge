package maimemo

import (
	"context"
	"testing"
	"time"
)

type fakeClient struct {
	calls int
	resp  *QueryStudyRecordsResponse
	err   error
}

func (f *fakeClient) GetStudyProgress(context.Context, string) (*StudyProgress, error) {
	return nil, nil
}

func (f *fakeClient) QueryStudyRecords(context.Context, string, QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error) {
	f.calls++
	return f.resp, f.err
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

func TestServiceSyncMapsAndCachesRecords(t *testing.T) {
	next := time.Now()
	client := &fakeClient{resp: &QueryStudyRecordsResponse{
		Records: []StudyRecord{{
			VocID:         "voc-1",
			VocSpelling:   "competent",
			LastResponse:  "FORGET",
			StudyCount:    14,
			Tags:          []string{"STICKING"},
			NextStudyDate: &next,
		}},
		TotalCount: 1,
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

	if client.calls != 1 {
		t.Fatalf("client calls = %d, want 1 due to debounce cache", client.calls)
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
