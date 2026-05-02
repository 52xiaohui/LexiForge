package vocabulary

import (
	"testing"
	"time"
)

func TestCalculateScoreForgetStickingDue(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	next := time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)

	got := CalculateScore(ScoreInput{
		LastResponse:  "forget",
		StudyCount:    14,
		Tags:          []string{"STICKING"},
		NextStudyDate: &next,
	}, now)

	if got.MasteryScore != 0 {
		t.Fatalf("MasteryScore = %d, want 0", got.MasteryScore)
	}
	if got.WeakScore != 184 {
		t.Fatalf("WeakScore = %d, want 184", got.WeakScore)
	}
	for _, key := range []string{"sticking_tag_weak", "study_count", "due_today_weak"} {
		if _, ok := got.Reasons[key]; !ok {
			t.Fatalf("Reasons missing %q: %#v", key, got.Reasons)
		}
	}
}

func TestCalculateScoreWellFamiliarFuture(t *testing.T) {
	now := time.Date(2026, 5, 2, 10, 0, 0, 0, time.UTC)
	next := now.AddDate(0, 0, 30)

	got := CalculateScore(ScoreInput{
		LastResponse:  "WELL_FAMILIAR",
		StudyCount:    2,
		NextStudyDate: &next,
	}, now)

	if got.MasteryScore != 100 {
		t.Fatalf("MasteryScore = %d, want 100", got.MasteryScore)
	}
	if got.WeakScore != -28 {
		t.Fatalf("WeakScore = %d, want -28", got.WeakScore)
	}
}

func TestNormalizeLastResponseUnknown(t *testing.T) {
	if got := NormalizeLastResponse(""); got != "UNKNOWN" {
		t.Fatalf("NormalizeLastResponse empty = %q, want UNKNOWN", got)
	}
	if got := NormalizeLastResponse("something"); got != "UNKNOWN" {
		t.Fatalf("NormalizeLastResponse unsupported = %q, want UNKNOWN", got)
	}
}
