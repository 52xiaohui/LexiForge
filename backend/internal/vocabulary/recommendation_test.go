package vocabulary

import (
	"testing"
	"time"
)

func TestCalculateRecommendationUsesLatestFeedbackAndExposureCooldown(t *testing.T) {
	now := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	recognized := now.Add(-48 * time.Hour)
	failed := now.Add(-time.Hour)
	exposed := now.Add(-30 * time.Minute)

	got := CalculateRecommendation(RecommendationInput{
		WeakScore:        80,
		Pinned:           true,
		LastRecognizedAt: &recognized,
		LastFailedAt:     &failed,
		LastExposedAt:    &exposed,
	}, now)

	if got.Score != 130 {
		t.Fatalf("score = %d, want 130", got.Score)
	}
	if got.Version != RecommendationVersionV2 {
		t.Fatalf("version = %q, want %q", got.Version, RecommendationVersionV2)
	}
	if got.Reasons["failed_in_context"] != 35 || got.Reasons["recent_article_exposure"] != -25 {
		t.Fatalf("reasons = %#v, want failure boost and exposure cooldown", got.Reasons)
	}
	if _, exists := got.Reasons["recognized_in_context"]; exists {
		t.Fatalf("reasons = %#v, older recognition should not beat latest failure", got.Reasons)
	}
}

func TestCalculateRecommendationTemporarilySuppressesRecentRecognition(t *testing.T) {
	now := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	recognized := now.Add(-24 * time.Hour)

	got := CalculateRecommendation(RecommendationInput{
		WeakScore:        100,
		LastRecognizedAt: &recognized,
	}, now)

	if got.Score != 65 || got.Reasons["recognized_in_context"] != -35 {
		t.Fatalf("result = %#v, want recent recognition cooldown", got)
	}
}
