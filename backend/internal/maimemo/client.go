package maimemo

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
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
// Requests are JSON POST calls with a bearer token. The client never logs the
// token or response body.
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

var (
	ErrInvalidToken = errors.New("maimemo token invalid")
	ErrUnavailable  = errors.New("maimemo api unavailable")
)

func (c *HTTPClient) GetStudyProgress(ctx context.Context, token string) (*StudyProgress, error) {
	var out StudyProgress
	if err := c.postJSON(ctx, token, "/study/progress", struct{}{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *HTTPClient) QueryStudyRecords(ctx context.Context, token string, req QueryStudyRecordsRequest) (*QueryStudyRecordsResponse, error) {
	var out QueryStudyRecordsResponse
	if err := c.postJSON(ctx, token, "/study/query_study_records", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *HTTPClient) GetTodayItems(ctx context.Context, token string, req GetTodayItemsRequest) (*GetTodayItemsResponse, error) {
	var out GetTodayItemsResponse
	if err := c.postJSON(ctx, token, "/study/today_items", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *HTTPClient) postJSON(ctx context.Context, token, path string, in, out any) error {
	body, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("marshal maimemo request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, joinURL(c.baseURL, path), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build maimemo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		io.Copy(io.Discard, resp.Body)
		return ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("%w: status %d", ErrUnavailable, resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode maimemo response: %w", err)
	}
	return nil
}

func joinURL(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}
