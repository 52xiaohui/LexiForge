package ai

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"lexiforge/backend/internal/config"
)

func TestOpenAIClientGenerateArticle(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("path = %s, want /chat/completions", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("Authorization = %q, want bearer key", got)
		}
		var req chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.ResponseFormat.Type != "json_schema" {
			t.Fatalf("response_format = %s, want json_schema", req.ResponseFormat.Type)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"model":"gpt-test",
			"choices":[{"message":{"role":"assistant","content":"{\"title\":\"Campus\",\"content_markdown\":\"competent students\",\"summary\":\"summary\",\"covered_words\":[{\"spelling\":\"competent\",\"form\":\"competent\",\"occurrence\":1,\"context_before\":\"\",\"context_after\":\" students\"}],\"missing_words\":[]}"}}],
			"usage":{"prompt_tokens":12,"completion_tokens":34}
		}`))
	}))
	defer server.Close()

	client := NewOpenAIClient(config.Config{
		OpenAIAPIKey:  "test-key",
		OpenAIBaseURL: server.URL,
		OpenAIModel:   "gpt-test",
	})
	got, err := client.GenerateArticle(context.Background(), GenerateArticleRequest{
		Topic:           "campus",
		Difficulty:      "B1",
		TargetWordCount: 1,
		ArticleLength:   "short",
		TargetWords:     []TargetWord{{Word: "competent"}},
	})
	if err != nil {
		t.Fatalf("GenerateArticle returned error: %v", err)
	}
	if got.Title != "Campus" || got.ModelName != "gpt-test" || got.InputTokens != 12 || got.OutputTokens != 34 {
		t.Fatalf("response = %#v, want parsed article with usage/model", got)
	}
}

func TestOpenAIClientMissingKey(t *testing.T) {
	client := NewOpenAIClient(config.Config{OpenAIBaseURL: "http://example.test", OpenAIModel: "gpt-test"})
	_, err := client.GenerateArticle(context.Background(), GenerateArticleRequest{})
	if !errors.Is(err, ErrAPIKeyMissing) {
		t.Fatalf("error = %v, want ErrAPIKeyMissing", err)
	}
}

func TestOpenAIClientNormalizesLooseJSONSchemaResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		content := "```json\n" +
			`{"content_markdown":"Students **fund** a club project.","covered_words":[{"word":"fund","occurrence":"1","context_before":"Students **","context_after":"** a"}]}` +
			"\n```"
		_ = json.NewEncoder(w).Encode(map[string]any{
			"model": "kimi-test",
			"choices": []any{
				map[string]any{"message": chatMessage{Role: "assistant", Content: content}},
			},
			"usage": map[string]int{"prompt_tokens": 1, "completion_tokens": 2},
		})
	}))
	defer server.Close()

	client := NewOpenAIClient(config.Config{
		OpenAIAPIKey:  "test-key",
		OpenAIBaseURL: server.URL,
		OpenAIModel:   "kimi-test",
	})
	got, err := client.GenerateArticle(context.Background(), GenerateArticleRequest{
		Topic:           "campus life",
		Difficulty:      "B1",
		TargetWordCount: 1,
		ArticleLength:   "short",
		TargetWords:     []TargetWord{{Word: "fund"}},
	})
	if err != nil {
		t.Fatalf("GenerateArticle returned error: %v", err)
	}
	if got.Title != "campus life" || got.Summary == "" || len(got.MissingWords) != 0 {
		t.Fatalf("fallback fields = %#v, want title/summary/empty missing words", got)
	}
	if len(got.CoveredWords) != 1 {
		t.Fatalf("covered words = %d, want 1", len(got.CoveredWords))
	}
	word := got.CoveredWords[0]
	if word.Spelling != "fund" || word.Form != "fund" || word.Occurrence != 1 {
		t.Fatalf("covered word = %#v, want normalized spelling/form/occurrence", word)
	}
}
