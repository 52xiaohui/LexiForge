package maimemo

import (
	"encoding/json"
	"fmt"
	"time"
)

// QueryStudyRecordsRequest mirrors the upstream `/study/query_study_records`
// payload. Field names follow MaiMemo's casing so JSON marshaling is direct.
type QueryStudyRecordsRequest struct {
	NextStudyDate *StudyDateRange `json:"next_study_date,omitempty"`
	AsCount       bool            `json:"as_count,omitempty"`
	Limit         int             `json:"limit,omitempty"`
}

type StudyDateRange struct {
	Start *time.Time `json:"start,omitempty"`
	End   *time.Time `json:"end,omitempty"`
}

// StudyRecord is one entry returned by the upstream sync API. Field set
// reflects what docs/01-product.md verified is currently exposed.
type StudyRecord struct {
	VocID          string     `json:"voc_id"`
	VocSpelling    string     `json:"voc_spelling"`
	AddDate        *time.Time `json:"add_date,omitempty"`
	FirstStudyDate *time.Time `json:"first_study_date,omitempty"`
	LastStudyDate  *time.Time `json:"last_study_date,omitempty"`
	NextStudyDate  *time.Time `json:"next_study_date,omitempty"`
	LastResponse   string     `json:"last_response,omitempty"`
	StudyCount     int        `json:"study_count,omitempty"`
	Tags           []string   `json:"tags,omitempty"`
}

func (r *StudyRecord) UnmarshalJSON(data []byte) error {
	type rawStudyRecord struct {
		VocID          string          `json:"voc_id"`
		VocSpelling    string          `json:"voc_spelling"`
		AddDate        *time.Time      `json:"add_date,omitempty"`
		FirstStudyDate *time.Time      `json:"first_study_date,omitempty"`
		LastStudyDate  *time.Time      `json:"last_study_date,omitempty"`
		NextStudyDate  *time.Time      `json:"next_study_date,omitempty"`
		LastResponse   string          `json:"last_response,omitempty"`
		StudyCount     int             `json:"study_count,omitempty"`
		Tags           json.RawMessage `json:"tags,omitempty"`
	}
	var raw rawStudyRecord
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	tags, err := decodeStudyTags(raw.Tags)
	if err != nil {
		return err
	}
	*r = StudyRecord{
		VocID:          raw.VocID,
		VocSpelling:    raw.VocSpelling,
		AddDate:        raw.AddDate,
		FirstStudyDate: raw.FirstStudyDate,
		LastStudyDate:  raw.LastStudyDate,
		NextStudyDate:  raw.NextStudyDate,
		LastResponse:   raw.LastResponse,
		StudyCount:     raw.StudyCount,
		Tags:           tags,
	}
	return nil
}

func decodeStudyTags(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var tags []string
	if err := json.Unmarshal(raw, &tags); err == nil {
		return tags, nil
	}
	var tag string
	if err := json.Unmarshal(raw, &tag); err == nil {
		if tag == "" {
			return nil, nil
		}
		return []string{tag}, nil
	}
	return nil, fmt.Errorf("decode maimemo study tags")
}

// QueryStudyRecordsResponse is the upstream paginated response.
type QueryStudyRecordsResponse struct {
	Records    []StudyRecord `json:"records"`
	TotalCount int           `json:"total_count"`
	Cursor     string        `json:"cursor,omitempty"`
	Count      int           `json:"count,omitempty"`
}

// StudyProgress is the upstream summary endpoint response.
type StudyProgress struct {
	TotalLearned int `json:"total_learned"`
	TotalKnown   int `json:"total_known"`
	TotalWeak    int `json:"total_weak"`
}

// GetTodayItemsRequest mirrors the upstream "today's queue" payload.
type GetTodayItemsRequest struct {
	Limit int `json:"limit,omitempty"`
}

// GetTodayItemsResponse is the upstream "today" feed.
type GetTodayItemsResponse struct {
	Items []StudyRecord `json:"items"`
}
