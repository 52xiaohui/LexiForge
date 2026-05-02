// Package ai wraps calls to the OpenAI-compatible chat completion API for
// article generation.
//
// Article + coverage logic from docs/05-ai-workflow.md will sit on top of
// this client. MVP keeps the surface minimal: one method, structured I/O.
package ai

import (
	"context"
	"errors"
	"net/http"
	"time"

	"lexiforge/backend/internal/config"
)

// GenerateArticleRequest carries the AI prompt inputs assembled by the
// article service. Fields here are the only ones allowed to leave our
// servers — see docs/01-product.md "AI 数据最小化".
type GenerateArticleRequest struct {
	Topic           string       `json:"topic"`
	Difficulty      string       `json:"difficulty"`
	TargetWordCount int          `json:"target_word_count"`
	ArticleLength   string       `json:"article_length"`
	TargetWords     []TargetWord `json:"target_words"`
	PromptVersion   string       `json:"prompt_version"`
}

// TargetWord is the per-word slice sent to the AI.
type TargetWord struct {
	Word         string   `json:"word"`
	LastResponse string   `json:"last_response,omitempty"`
	StudyCount   int      `json:"study_count,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// GenerateArticleResponse is what the AI client returns. Coverage validation
// uses CoveredWords' verbatim context strings to locate offsets in the
// markdown — see docs/05-ai-workflow.md.
type GenerateArticleResponse struct {
	Title           string        `json:"title"`
	ContentMarkdown string        `json:"content_markdown"`
	Summary         string        `json:"summary"`
	CoveredWords    []CoveredWord `json:"covered_words"`
	ModelName       string        `json:"model_name"`
	InputTokens     int           `json:"input_tokens"`
	OutputTokens    int           `json:"output_tokens"`
}

// CoveredWord is the AI's claim that `Form` appeared in the article between
// `ContextBefore` and `ContextAfter`. The backend later locates char offsets
// by IndexOf-ing the concatenated triple.
type CoveredWord struct {
	Spelling      string `json:"spelling"`
	Form          string `json:"form"`
	ContextBefore string `json:"context_before"`
	ContextAfter  string `json:"context_after"`
}

// Client abstracts the AI surface so tests / mocks plug in cleanly.
type Client interface {
	GenerateArticle(ctx context.Context, req GenerateArticleRequest) (*GenerateArticleResponse, error)
}

// OpenAIClient targets any OpenAI-compatible chat completions endpoint.
type OpenAIClient struct {
	httpClient *http.Client
	apiKey     string
	baseURL    string
	model      string
}

// NewOpenAIClient builds the production client from the config snapshot.
func NewOpenAIClient(cfg config.Config) *OpenAIClient {
	return &OpenAIClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		apiKey:     cfg.OpenAIAPIKey,
		baseURL:    cfg.OpenAIBaseURL,
		model:      cfg.OpenAIModel,
	}
}

// ErrNotImplemented is returned by every skeleton method.
var ErrNotImplemented = errors.New("ai client: not implemented")

// GenerateArticle is a stub; wired up in a later task.
func (c *OpenAIClient) GenerateArticle(_ context.Context, _ GenerateArticleRequest) (*GenerateArticleResponse, error) {
	return nil, ErrNotImplemented
}
