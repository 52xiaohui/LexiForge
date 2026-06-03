// Package ai wraps calls to the OpenAI-compatible chat completion API for
// article generation.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"lexiforge/backend/internal/config"
)

// GenerateArticleRequest carries the AI prompt inputs assembled by the
// article service. Fields here are the only ones allowed to leave our servers.
type GenerateArticleRequest struct {
	Topic           string       `json:"topic"`
	Difficulty      string       `json:"difficulty"`
	TargetWordCount int          `json:"target_word_count"`
	ArticleLength   string       `json:"article_length"`
	TargetWords     []TargetWord `json:"target_words"`
	PromptVersion   string       `json:"prompt_version"`
	MissingWords    []string     `json:"missing_words,omitempty"`
}

// TargetWord is the per-word slice sent to the AI.
type TargetWord struct {
	Word         string   `json:"word"`
	LastResponse string   `json:"last_response,omitempty"`
	StudyCount   int      `json:"study_count,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// GenerateArticleResponse is the structured article JSON returned by the AI.
type GenerateArticleResponse struct {
	Title           string        `json:"title"`
	ContentMarkdown string        `json:"content_markdown"`
	Summary         string        `json:"summary"`
	CoveredWords    []CoveredWord `json:"covered_words"`
	MissingWords    []string      `json:"missing_words"`
	ModelName       string        `json:"model_name"`
	InputTokens     int           `json:"input_tokens"`
	OutputTokens    int           `json:"output_tokens"`
}

// CoveredWord is the AI's claim that Form appeared between verbatim context
// strings in ContentMarkdown.
type CoveredWord struct {
	Spelling      string `json:"spelling"`
	Form          string `json:"form"`
	Occurrence    int    `json:"occurrence"`
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

var (
	ErrAPIKeyMissing     = errors.New("openai api key missing")
	ErrGenerationFailed  = errors.New("ai generation failed")
	ErrInvalidAIResponse = errors.New("invalid ai response")
)

func (c *OpenAIClient) GenerateArticle(ctx context.Context, req GenerateArticleRequest) (*GenerateArticleResponse, error) {
	if c.apiKey == "" {
		return nil, ErrAPIKeyMissing
	}

	body := chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: articleSystemPrompt()},
			{Role: "user", Content: articleUserPrompt(req)},
		},
		Temperature: 0.7,
		ResponseFormat: responseFormat{
			Type: "json_schema",
			JSONSchema: &jsonSchemaFormat{
				Name:   "lexiforge_article",
				Strict: true,
				Schema: articleResponseSchema(),
			},
		},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal ai request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, joinURL(c.baseURL, "/chat/completions"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build ai request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGenerationFailed, err)
	}
	defer httpResp.Body.Close()
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		io.Copy(io.Discard, httpResp.Body)
		return nil, fmt.Errorf("%w: status %d", ErrGenerationFailed, httpResp.StatusCode)
	}

	var chatResp chatCompletionResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&chatResp); err != nil {
		return nil, fmt.Errorf("%w: decode chat response: %v", ErrInvalidAIResponse, err)
	}
	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("%w: empty chat content", ErrInvalidAIResponse)
	}

	out, err := parseArticleContent(chatResp.Choices[0].Message.Content, req)
	if err != nil {
		return nil, err
	}
	out.ModelName = chatResp.Model
	out.InputTokens = chatResp.Usage.PromptTokens
	out.OutputTokens = chatResp.Usage.CompletionTokens
	return out, nil
}

type chatCompletionRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	Temperature    float64        `json:"temperature"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type       string            `json:"type"`
	JSONSchema *jsonSchemaFormat `json:"json_schema,omitempty"`
}

type jsonSchemaFormat struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type chatCompletionResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func articleSystemPrompt() string {
	return `You generate natural English learning articles for vocabulary practice. Return only a raw JSON object matching the schema. Do not wrap it in markdown fences. Use exact field names: title, content_markdown, summary, covered_words, missing_words, and covered_words[].spelling/form/occurrence/context_before/context_after. Do not use "word" instead of "spelling". For each covered word, context_before and context_after must be exact verbatim characters immediately adjacent to form in content_markdown. Do not generate exercises.`
}

func articleUserPrompt(req GenerateArticleRequest) string {
	data, _ := json.Marshal(req)
	return "Generate an English article for this request. Use target words naturally. Do not apply Markdown emphasis, bold, italics, or other inline markup to target words or any article text. If missing_words is present, revise to include them while preserving topic and difficulty.\n\n" + string(data)
}

func articleResponseSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"title", "content_markdown", "summary", "covered_words", "missing_words"},
		"properties": map[string]any{
			"title":            map[string]any{"type": "string"},
			"content_markdown": map[string]any{"type": "string"},
			"summary":          map[string]any{"type": "string"},
			"covered_words": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"spelling", "form", "occurrence", "context_before", "context_after"},
					"properties": map[string]any{
						"spelling":       map[string]any{"type": "string"},
						"form":           map[string]any{"type": "string"},
						"occurrence":     map[string]any{"type": "integer"},
						"context_before": map[string]any{"type": "string"},
						"context_after":  map[string]any{"type": "string"},
					},
				},
			},
			"missing_words": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
		},
	}
}

func joinURL(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}

type articleContentWire struct {
	Title           string            `json:"title"`
	ContentMarkdown string            `json:"content_markdown"`
	Summary         string            `json:"summary"`
	CoveredWords    []coveredWordWire `json:"covered_words"`
	MissingWords    []string          `json:"missing_words"`
}

type coveredWordWire struct {
	Spelling      string             `json:"spelling"`
	Word          string             `json:"word"`
	Form          string             `json:"form"`
	Occurrence    flexibleOccurrence `json:"occurrence"`
	ContextBefore string             `json:"context_before"`
	ContextAfter  string             `json:"context_after"`
}

type flexibleOccurrence int

func (o *flexibleOccurrence) UnmarshalJSON(data []byte) error {
	var number int
	if err := json.Unmarshal(data, &number); err == nil {
		*o = flexibleOccurrence(number)
		return nil
	}
	var text string
	if err := json.Unmarshal(data, &text); err == nil {
		text = strings.TrimSpace(text)
		if text == "" {
			return nil
		}
		parsed, err := strconv.Atoi(text)
		if err != nil {
			return fmt.Errorf("parse occurrence: %w", err)
		}
		*o = flexibleOccurrence(parsed)
		return nil
	}
	return fmt.Errorf("occurrence must be an integer or numeric string")
}

func parseArticleContent(content string, req GenerateArticleRequest) (*GenerateArticleResponse, error) {
	cleaned := extractJSONObject(content)
	var wire articleContentWire
	if err := json.Unmarshal([]byte(cleaned), &wire); err != nil {
		return nil, fmt.Errorf("%w: decode article json: %v", ErrInvalidAIResponse, err)
	}
	out := GenerateArticleResponse{
		Title:           strings.TrimSpace(wire.Title),
		ContentMarkdown: strings.TrimSpace(wire.ContentMarkdown),
		Summary:         strings.TrimSpace(wire.Summary),
		MissingWords:    wire.MissingWords,
	}
	if out.Title == "" {
		out.Title = fallbackTitle(req.Topic)
	}
	if out.Summary == "" {
		out.Summary = fallbackSummary(out.ContentMarkdown)
	}
	if out.MissingWords == nil {
		out.MissingWords = []string{}
	}
	for _, word := range wire.CoveredWords {
		normalized := normalizeCoveredWord(word)
		if normalized.Spelling == "" || normalized.Form == "" {
			continue
		}
		out.CoveredWords = append(out.CoveredWords, normalized)
	}
	if out.ContentMarkdown == "" {
		return nil, fmt.Errorf("%w: empty content_markdown", ErrInvalidAIResponse)
	}
	return &out, nil
}

func extractJSONObject(content string) string {
	cleaned := strings.TrimSpace(content)
	if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimPrefix(cleaned, "```JSON")
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
		if strings.HasSuffix(cleaned, "```") {
			cleaned = strings.TrimSpace(strings.TrimSuffix(cleaned, "```"))
		}
	}
	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start >= 0 && end >= start {
		return cleaned[start : end+1]
	}
	return cleaned
}

func normalizeCoveredWord(word coveredWordWire) CoveredWord {
	spelling := strings.TrimSpace(word.Spelling)
	if spelling == "" {
		spelling = strings.TrimSpace(word.Word)
	}
	form := strings.TrimSpace(word.Form)
	if form == "" {
		form = spelling
	}
	occurrence := int(word.Occurrence)
	if occurrence < 1 {
		occurrence = 1
	}
	return CoveredWord{
		Spelling:      spelling,
		Form:          form,
		Occurrence:    occurrence,
		ContextBefore: word.ContextBefore,
		ContextAfter:  word.ContextAfter,
	}
}

func fallbackTitle(topic string) string {
	topic = strings.TrimSpace(topic)
	if topic == "" {
		return "Generated Article"
	}
	return topic
}

func fallbackSummary(content string) string {
	content = strings.Join(strings.Fields(strings.TrimSpace(content)), " ")
	if content == "" {
		return ""
	}
	if dot := strings.Index(content, "."); dot >= 0 && dot < 240 {
		return content[:dot+1]
	}
	if len(content) > 240 {
		return content[:240]
	}
	return content
}
