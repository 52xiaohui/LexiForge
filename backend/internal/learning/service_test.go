package learning

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
)

type fakeLearningRepo struct {
	ownsWord    bool
	ownsArticle bool
	created     WordLearningEvent
}

func (f *fakeLearningRepo) UserOwnsWord(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return f.ownsWord, nil
}

func (f *fakeLearningRepo) ArticleBelongsToUser(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return f.ownsArticle, nil
}

func (f *fakeLearningRepo) CreateEvent(_ context.Context, event WordLearningEvent) (WordLearningEvent, error) {
	f.created = event
	event.ID = uuid.New()
	return event, nil
}

func TestRecordEventCreatesValidatedEvent(t *testing.T) {
	wordID := uuid.New()
	articleID := uuid.New()
	repo := &fakeLearningRepo{ownsWord: true, ownsArticle: true}
	svc := NewService(repo)

	got, err := svc.RecordEvent(context.Background(), EventRequest{
		WordID:    wordID.String(),
		ArticleID: stringPtr(articleID.String()),
		EventType: EventRecognizedInContext,
		Source:    "reader",
		Metadata:  map[string]any{"paragraph_index": float64(3)},
	})
	if err != nil {
		t.Fatalf("RecordEvent returned error: %v", err)
	}
	if got.WordID != wordID || got.ArticleID == nil || *got.ArticleID != articleID {
		t.Fatalf("response = %#v, want requested word and article IDs", got)
	}
	if repo.created.EventType != EventRecognizedInContext || repo.created.Source != "reader" {
		t.Fatalf("created event = %#v, want normalized event", repo.created)
	}
	var metadata map[string]any
	if err := json.Unmarshal(repo.created.Metadata, &metadata); err != nil {
		t.Fatalf("decode metadata: %v", err)
	}
	if metadata["paragraph_index"] != float64(3) {
		t.Fatalf("metadata = %#v, want paragraph_index 3", metadata)
	}
}

func TestRecordEventRejectsUnsupportedType(t *testing.T) {
	svc := NewService(&fakeLearningRepo{ownsWord: true})

	_, err := svc.RecordEvent(context.Background(), EventRequest{
		WordID:    uuid.NewString(),
		EventType: "read",
		Source:    "reader",
	})
	if err == nil {
		t.Fatal("error = nil, want invalid event error")
	}
	if !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("error = %v, want ErrInvalidEvent", err)
	}
}

func TestRecordEventRequiresOwnedWord(t *testing.T) {
	svc := NewService(&fakeLearningRepo{ownsWord: false})

	_, err := svc.RecordEvent(context.Background(), EventRequest{
		WordID:    uuid.NewString(),
		EventType: EventFailedInContext,
		Source:    "reader",
	})
	if !errors.Is(err, ErrEventWordNotFound) {
		t.Fatalf("error = %v, want ErrEventWordNotFound", err)
	}
}

func stringPtr(value string) *string { return &value }
