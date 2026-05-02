package maimemo

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPClientQueryStudyRecords(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/study/query_study_records" {
			t.Fatalf("path = %s, want /study/query_study_records", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer secret-token" {
			t.Fatalf("Authorization = %q, want bearer token", got)
		}
		var req QueryStudyRecordsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Limit != 1000 {
			t.Fatalf("Limit = %d, want 1000", req.Limit)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"success":true,"errors":[],"data":{"records":[{"voc_id":"1","voc_spelling":"competent","last_response":"FORGET","study_count":14,"tags":["STICKING"]}],"count":1}}`))
	}))
	defer server.Close()

	client := NewHTTPClient(server.URL)
	got, err := client.QueryStudyRecords(context.Background(), "secret-token", QueryStudyRecordsRequest{Limit: 1000})
	if err != nil {
		t.Fatalf("QueryStudyRecords returned error: %v", err)
	}
	if got.Count != 1 || len(got.Records) != 1 {
		t.Fatalf("response = %#v, want one record", got)
	}
	if got.Records[0].VocSpelling != "competent" {
		t.Fatalf("VocSpelling = %q, want competent", got.Records[0].VocSpelling)
	}
}

func TestHTTPClientInvalidToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewHTTPClient(server.URL)
	_, err := client.QueryStudyRecords(context.Background(), "bad-token", QueryStudyRecordsRequest{Limit: 1000})
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("error = %v, want ErrInvalidToken", err)
	}
}
