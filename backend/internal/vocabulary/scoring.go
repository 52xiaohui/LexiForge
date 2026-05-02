package vocabulary

import (
	"strings"
	"time"
)

const ScoreVersionV1 = "v1"

type ScoreInput struct {
	LastResponse  string
	StudyCount    int
	Tags          []string
	NextStudyDate *time.Time
}

type ScoreResult struct {
	MasteryScore int
	WeakScore    int
	Reasons      map[string]int
}

func CalculateScore(input ScoreInput, now time.Time) ScoreResult {
	response := NormalizeLastResponse(input.LastResponse)
	reasons := map[string]int{}

	mastery := masteryBase(response)
	reasons["mastery_base_"+response] = mastery

	weak := weakResponseWeight(response)
	if weak != 0 {
		reasons["weak_response_"+response] = weak
	}

	if hasTag(input.Tags, "STICKING") {
		mastery -= 25
		weak += 50
		reasons["sticking_tag_mastery"] = -25
		reasons["sticking_tag_weak"] = 50
	}

	if input.StudyCount >= 10 && response == "FORGET" {
		mastery -= 10
		reasons["repeated_forget"] = -10
	}

	countBonus := input.StudyCount
	if countBonus > 30 {
		countBonus = 30
	}
	if countBonus > 0 {
		weak += countBonus
		reasons["study_count"] = countBonus
	}

	if input.NextStudyDate != nil {
		switch dueBonus(*input.NextStudyDate, now) {
		case "due_today":
			mastery -= 5
			weak += 20
			reasons["due_today_mastery"] = -5
			reasons["due_today_weak"] = 20
		case "due_soon":
			weak += 10
			reasons["due_soon"] = 10
		case "future_30_days":
			mastery += 5
			reasons["future_30_days"] = 5
		}
	}

	return ScoreResult{
		MasteryScore: clamp(mastery, 0, 100),
		WeakScore:    weak,
		Reasons:      reasons,
	}
}

func NormalizeLastResponse(response string) string {
	normalized := strings.ToUpper(strings.TrimSpace(response))
	switch normalized {
	case "WELL_FAMILIAR", "FAMILIAR", "VAGUE", "FORGET":
		return normalized
	default:
		return "UNKNOWN"
	}
}

func masteryBase(response string) int {
	switch response {
	case "WELL_FAMILIAR":
		return 95
	case "FAMILIAR":
		return 75
	case "VAGUE":
		return 45
	case "FORGET":
		return 20
	default:
		return 50
	}
}

func weakResponseWeight(response string) int {
	switch response {
	case "FORGET":
		return 100
	case "VAGUE":
		return 80
	case "FAMILIAR":
		return 20
	case "WELL_FAMILIAR":
		return -30
	default:
		return 0
	}
}

func hasTag(tags []string, target string) bool {
	for _, tag := range tags {
		if strings.EqualFold(strings.TrimSpace(tag), target) {
			return true
		}
	}
	return false
}

func dueBonus(nextStudyDate time.Time, now time.Time) string {
	next := dateOnly(nextStudyDate)
	today := dateOnly(now)
	switch {
	case !next.After(today):
		return "due_today"
	case !next.After(today.AddDate(0, 0, 7)):
		return "due_soon"
	case !next.Before(today.AddDate(0, 0, 30)):
		return "future_30_days"
	default:
		return ""
	}
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
