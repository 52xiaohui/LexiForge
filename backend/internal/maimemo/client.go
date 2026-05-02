package maimemo

import (
	"context"
	"errors"
	"net/http"
	"time"
)

// Client is the upstream MaiMemo Open API surface. Methods take an explicit
// `token` so v0.5 can pass per-user decrypted tokens without changing the
// signature.
//
// docs/04-api.md spells out the contract. All implementations must:
//   - honor ctx for cancellation/timeout
//   - never log the Authorization header
//   - return typed errors for invalid token / upstream-down cases
type Client interface {
	GetStudyProgress(ctx context.Context, token string) (*StudyProgress, error)
	QueryStudyRecords(ctx context.Context, token string, req QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error)
	GetTodayItems(ctx context.Context, token string, req GetTodayItemsRequest) (*GetTodayItemsResponse, error)
}

// HTTPClient is the production Client implementation backed by net/http.
//
// MVP skeleton: all methods return ErrNotImplemented. Wire-up happens in a
// follow-up task once the sync service starts consuming this.
type HTTPClient struct {
	httpClient *http.Client
	baseURL    string
}

// NewHTTPClient is the canonical constructor; pass empty baseURL to use the
// official MaiMemo endpoint default.
func NewHTTPClient(baseURL string) *HTTPClient {
	if baseURL == "" {
		baseURL = "https://open.maimemo.com/open/api/v1"
	}
	return &HTTPClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    baseURL,
	}
}

// ErrNotImplemented is the placeholder returned by every skeleton method.
var ErrNotImplemented = errors.New("maimemo client: not implemented")

// GetStudyProgress is a stub.
func (c *HTTPClient) GetStudyProgress(_ context.Context, _ string) (*StudyProgress, error) {
	return nil, ErrNotImplemented
}

// QueryStudyRecords is a stub.
func (c *HTTPClient) QueryStudyRecords(_ context.Context, _ string, _ QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error) {
	return nil, ErrNotImplemented
}

// GetTodayItems is a stub.
func (c *HTTPClient) GetTodayItems(_ context.Context, _ string, _ GetTodayItemsRequest) (*GetTodayItemsResponse, error) {
	return nil, ErrNotImplemented
}
