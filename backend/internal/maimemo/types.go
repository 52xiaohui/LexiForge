package maimemo

import "time"

// QueryStudyRecordsRequest mirrors the upstream `/study/query_study_records`
// payload. Field names follow MaiMemo's casing so JSON marshaling is direct.
type QueryStudyRecordsRequest struct {
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
	Cursor string `json:"cursor,omitempty"`
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
