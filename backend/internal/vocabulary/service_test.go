package vocabulary

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeVocabRepo struct {
	record RecordRow
	input  PreferenceInput
}

func (f *fakeVocabRepo) ListRecords(ListOptions) (ListResult, error) {
	return ListResult{}, nil
}

func (f *fakeVocabRepo) GetRecord(uuid.UUID, uuid.UUID) (RecordRow, error) {
	return f.record, nil
}

func (f *fakeVocabRepo) Summary(uuid.UUID) (Summary, error) {
	return Summary{}, nil
}

func (f *fakeVocabRepo) UpsertPreference(userID, wordID uuid.UUID, input PreferenceInput) (UserWordPreference, error) {
	f.input = input
	return UserWordPreference{
		ID:            uuid.New(),
		UserID:        userID,
		WordID:        wordID,
		Ignored:       input.Ignored,
		IgnoredReason: input.IgnoredReason,
		IgnoredUntil:  input.IgnoredUntil,
		Pinned:        input.Pinned,
		UpdatedAt:     time.Now(),
	}, nil
}

func TestUpdatePreferenceUsesRecordWordID(t *testing.T) {
	wordID := uuid.New()
	repo := &fakeVocabRepo{record: RecordRow{ID: uuid.New(), WordID: wordID}}
	svc := NewService(repo)
	ignored := true
	pinned := true
	reason := "not_relevant"

	got, err := svc.UpdatePreference(repo.record.ID.String(), PreferenceRequest{
		Ignored:       &ignored,
		IgnoredReason: &reason,
		Pinned:        &pinned,
	})
	if err != nil {
		t.Fatalf("UpdatePreference returned error: %v", err)
	}
	if got.WordID != wordID {
		t.Fatalf("word id = %s, want %s", got.WordID, wordID)
	}
	if !repo.input.Ignored || !repo.input.Pinned {
		t.Fatalf("input = %#v, want ignored and pinned", repo.input)
	}
	if repo.input.IgnoredReason == nil || *repo.input.IgnoredReason != "not_relevant" {
		t.Fatalf("ignored reason = %#v, want not_relevant", repo.input.IgnoredReason)
	}
}

func TestUpdatePreferenceClearsIgnoreMetadataWhenUnignored(t *testing.T) {
	repo := &fakeVocabRepo{record: RecordRow{ID: uuid.New(), WordID: uuid.New()}}
	svc := NewService(repo)
	ignored := false
	reason := "not_relevant"
	until := time.Now()

	_, err := svc.UpdatePreference(repo.record.ID.String(), PreferenceRequest{
		Ignored:       &ignored,
		IgnoredReason: &reason,
		IgnoredUntil:  &until,
	})
	if err != nil {
		t.Fatalf("UpdatePreference returned error: %v", err)
	}
	if repo.input.Ignored || repo.input.IgnoredReason != nil || repo.input.IgnoredUntil != nil {
		t.Fatalf("input = %#v, want ignore metadata cleared", repo.input)
	}
}
