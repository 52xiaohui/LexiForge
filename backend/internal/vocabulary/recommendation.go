package vocabulary

import "time"

const RecommendationVersionV2 = "v2"

type RecommendationInput struct {
	WeakScore        int
	Pinned           bool
	LastRecognizedAt *time.Time
	LastFailedAt     *time.Time
	LastExposedAt    *time.Time
}

type RecommendationResult struct {
	Score   int            `json:"score"`
	Version string         `json:"version"`
	Reasons map[string]int `json:"reasons"`
}

// CalculateRecommendation layers local LexiForge signals over the external
// weak score without mutating synced study facts.
func CalculateRecommendation(input RecommendationInput, now time.Time) RecommendationResult {
	reasons := map[string]int{"external_weak_score": input.WeakScore}
	score := input.WeakScore

	if input.Pinned {
		score += 40
		reasons["pinned"] = 40
	}

	if LatestFeedbackIsFailure(input.LastRecognizedAt, input.LastFailedAt) {
		weight := 15
		if ageWithin(input.LastFailedAt, now, 30*24*time.Hour) {
			weight = 35
		}
		score += weight
		reasons["failed_in_context"] = weight
	} else if input.LastRecognizedAt != nil {
		weight := -5
		switch {
		case ageWithin(input.LastRecognizedAt, now, 7*24*time.Hour):
			weight = -35
		case ageWithin(input.LastRecognizedAt, now, 30*24*time.Hour):
			weight = -20
		}
		score += weight
		reasons["recognized_in_context"] = weight
	}

	if input.LastExposedAt != nil {
		weight := 0
		switch {
		case ageWithin(input.LastExposedAt, now, 24*time.Hour):
			weight = -25
		case ageWithin(input.LastExposedAt, now, 7*24*time.Hour):
			weight = -10
		}
		if weight != 0 {
			score += weight
			reasons["recent_article_exposure"] = weight
		}
	}

	return RecommendationResult{
		Score:   score,
		Version: RecommendationVersionV2,
		Reasons: reasons,
	}
}

func LatestFeedbackIsFailure(recognizedAt, failedAt *time.Time) bool {
	return failedAt != nil && (recognizedAt == nil || !failedAt.Before(*recognizedAt))
}

func ageWithin(value *time.Time, now time.Time, window time.Duration) bool {
	if value == nil || value.After(now) {
		return false
	}
	return now.Sub(*value) <= window
}
