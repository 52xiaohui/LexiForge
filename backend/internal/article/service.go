package article

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"

	"lexiforge/backend/internal/ai"
	"lexiforge/backend/internal/user"
	"lexiforge/backend/internal/vocabulary"
)

const promptVersionV1 = "v1"

var markdownEmphasisRE = regexp.MustCompile(`\*{1,2}([^*\n]+?)\*{1,2}`)

// Service orchestrates article generation, coverage validation and listing.
type Service struct {
	repo repository
	ai   ai.Client
}

// NewService is the canonical constructor.
func NewService(repo repository, aiClient ai.Client) *Service {
	return &Service{repo: repo, ai: aiClient}
}

type repository interface {
	SelectTargetWords(ctx context.Context, userID uuid.UUID, selectedIDs []uuid.UUID, targetCount int) ([]TargetWordRecord, error)
	StartGenerationRun(ctx context.Context, run ArticleGenerationRun) (ArticleGenerationRun, error)
	FailGenerationRun(ctx context.Context, runID uuid.UUID, metrics GenerationRunMetrics) error
	ListGenerationRuns(ctx context.Context, userID uuid.UUID, limit int) ([]ArticleGenerationRun, error)
	SaveGeneratedArticle(ctx context.Context, draft ArticleDraft) (ArticleDetail, error)
	ListArticles(ctx context.Context, userID uuid.UUID, page, pageSize int) (ArticleListResult, error)
	GetArticle(ctx context.Context, userID, articleID uuid.UUID) (ArticleDetail, error)
	DeleteArticle(ctx context.Context, userID, articleID uuid.UUID) error
	GetArticleProgress(ctx context.Context, userID, articleID uuid.UUID) (UserArticleProgress, bool, error)
	UpsertArticleProgressWithExposures(ctx context.Context, progress UserArticleProgress, recordExposures bool) (UserArticleProgress, error)
}

type GenerateRequest struct {
	Topic           string   `json:"topic"`
	Difficulty      string   `json:"difficulty"`
	TargetWordCount int      `json:"target_word_count"`
	ArticleLength   string   `json:"article_length"`
	TargetWordIDs   []string `json:"target_word_ids"`
}

type GenerateResult struct {
	ArticleID        uuid.UUID `json:"article_id"`
	Status           string    `json:"status"`
	CoveredWordCount int       `json:"covered_word_count"`
	TargetWordCount  int       `json:"target_word_count"`
	CoverageRate     float64   `json:"coverage_rate"`
}

type PreviewRequest struct {
	TargetWordCount int      `json:"target_word_count"`
	TargetWordIDs   []string `json:"target_word_ids"`
}

type GenerationPreviewWord struct {
	ID                    uuid.UUID      `json:"id"`
	WordID                uuid.UUID      `json:"word_id"`
	Spelling              string         `json:"spelling"`
	LastResponse          string         `json:"last_response"`
	StudyCount            int            `json:"study_count"`
	Tags                  []string       `json:"tags"`
	MasteryScore          int            `json:"mastery_score"`
	WeakScore             int            `json:"weak_score"`
	NextStudyDate         *time.Time     `json:"next_study_date"`
	RecommendationScore   int            `json:"recommendation_score"`
	RecommendationVersion string         `json:"recommendation_version"`
	RecommendationReasons map[string]int `json:"recommendation_reasons"`
}

type GenerationPreviewResponse struct {
	Words            []GenerationPreviewWord `json:"words"`
	CountsByResponse map[string]int          `json:"counts_by_response"`
	StickingCount    int                     `json:"sticking_count"`
	AutoFillCount    int                     `json:"auto_fill_count"`
	IsAuto           bool                    `json:"is_auto"`
}

type GenerationRunResponse struct {
	ID              uuid.UUID  `json:"id"`
	ArticleID       *uuid.UUID `json:"article_id,omitempty"`
	Status          string     `json:"status"`
	Topic           string     `json:"topic"`
	Difficulty      string     `json:"difficulty"`
	ArticleLength   string     `json:"article_length"`
	TargetWordCount int        `json:"target_word_count"`
	ModelName       string     `json:"model_name"`
	PromptVersion   string     `json:"prompt_version"`
	AttemptCount    int        `json:"attempt_count"`
	InputTokens     int        `json:"input_tokens"`
	OutputTokens    int        `json:"output_tokens"`
	DurationMS      int64      `json:"duration_ms"`
	CoverageRate    float64    `json:"coverage_rate"`
	ErrorCode       string     `json:"error_code,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type PagedArticles struct {
	Items    []ArticleListItem `json:"items"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

type ArticleResponse struct {
	ID                   uuid.UUID       `json:"id"`
	Title                string          `json:"title"`
	Topic                string          `json:"topic"`
	Difficulty           string          `json:"difficulty"`
	ArticleLength        string          `json:"article_length"`
	ContentMarkdown      string          `json:"content_markdown"`
	Summary              string          `json:"summary"`
	GenerationParams     json.RawMessage `json:"generation_params"`
	TargetWordCount      int             `json:"target_word_count"`
	CoveredWordCount     int             `json:"covered_word_count"`
	CoverageRate         float64         `json:"coverage_rate"`
	GenerationStatus     string          `json:"generation_status"`
	ModelName            string          `json:"model_name"`
	PromptVersion        string          `json:"prompt_version"`
	GenerationAttempts   int             `json:"generation_attempts"`
	GenerationDurationMS int64           `json:"generation_duration_ms"`
	InputTokens          int             `json:"input_tokens"`
	OutputTokens         int             `json:"output_tokens"`
	CreatedAt            string          `json:"created_at"`
}

type ArticleDetailResponse struct {
	Article ArticleResponse `json:"article"`
	Words   []ArticleWord   `json:"words"`
}

type ArticleProgressRequest struct {
	Status             string `json:"status"`
	ProgressPercent    *int   `json:"progress_percent"`
	LastParagraphIndex *int   `json:"last_paragraph_index"`
}

type ArticleProgressResponse struct {
	ID                 uuid.UUID  `json:"id,omitempty"`
	UserID             uuid.UUID  `json:"user_id"`
	ArticleID          uuid.UUID  `json:"article_id"`
	Status             string     `json:"status"`
	ProgressPercent    int        `json:"progress_percent"`
	LastParagraphIndex *int       `json:"last_paragraph_index,omitempty"`
	StartedAt          *time.Time `json:"started_at,omitempty"`
	CompletedAt        *time.Time `json:"completed_at,omitempty"`
	UpdatedAt          *time.Time `json:"updated_at,omitempty"`
}

type APIError struct {
	Status  int
	Code    string
	Message string
	Details any
}

func (e APIError) Error() string { return e.Code + ": " + e.Message }

var ErrAIGenerationUnavailable = errors.New("ai generation unavailable")

func (s *Service) Preview(ctx context.Context, req PreviewRequest) (GenerationPreviewResponse, error) {
	if err := validateTargetSelection(req.TargetWordCount, req.TargetWordIDs); err != nil {
		return GenerationPreviewResponse{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return GenerationPreviewResponse{}, err
	}
	selectedIDs, err := parseUUIDs(req.TargetWordIDs)
	if err != nil {
		return GenerationPreviewResponse{}, err
	}
	targets, err := s.repo.SelectTargetWords(ctx, userID, selectedIDs, req.TargetWordCount)
	if err != nil {
		return GenerationPreviewResponse{}, APIError{Status: 422, Code: "TARGET_WORDS_INVALID", Message: "selected target words are invalid or not owned by the local user"}
	}

	response := GenerationPreviewResponse{
		Words: make([]GenerationPreviewWord, 0, len(targets)),
		CountsByResponse: map[string]int{
			"FORGET": 0, "VAGUE": 0, "FAMILIAR": 0, "WELL_FAMILIAR": 0,
		},
		IsAuto: len(selectedIDs) == 0,
	}
	for _, target := range targets {
		response.Words = append(response.Words, GenerationPreviewWord{
			ID:                    target.RecordID,
			WordID:                target.WordID,
			Spelling:              target.Spelling,
			LastResponse:          target.LastResponse,
			StudyCount:            target.StudyCount,
			Tags:                  target.Tags,
			MasteryScore:          target.MasteryScore,
			WeakScore:             target.WeakScore,
			NextStudyDate:         target.NextStudyDate,
			RecommendationScore:   target.RecommendationScore,
			RecommendationVersion: target.RecommendationVersion,
			RecommendationReasons: target.RecommendationReasons,
		})
		response.CountsByResponse[target.LastResponse]++
		if hasTargetTag(target.Tags, "STICKING") {
			response.StickingCount++
		}
	}
	manualCount := uniqueUUIDCount(selectedIDs)
	if manualCount > len(targets) {
		manualCount = len(targets)
	}
	response.AutoFillCount = len(targets) - manualCount
	return response, nil
}

func (s *Service) Generate(ctx context.Context, req GenerateRequest) (GenerateResult, error) {
	if s.ai == nil {
		return GenerateResult{}, ErrAIGenerationUnavailable
	}
	normalized, err := validateGenerateRequest(req)
	if err != nil {
		return GenerateResult{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return GenerateResult{}, err
	}
	selectedIDs, err := parseUUIDs(normalized.TargetWordIDs)
	if err != nil {
		return GenerateResult{}, err
	}

	targets, err := s.repo.SelectTargetWords(ctx, userID, selectedIDs, normalized.TargetWordCount)
	if err != nil {
		return GenerateResult{}, APIError{Status: 422, Code: "TARGET_WORDS_INVALID", Message: "selected target words are invalid or not owned by the local user"}
	}
	if len(targets) < normalized.TargetWordCount {
		return GenerateResult{}, APIError{
			Status:  422,
			Code:    "TARGET_WORDS_NOT_ENOUGH",
			Message: "not enough vocabulary records to generate the requested article",
			Details: map[string]any{"available": len(targets), "target_word_count": normalized.TargetWordCount},
		}
	}
	generationStarted := time.Now()
	run, err := s.repo.StartGenerationRun(ctx, ArticleGenerationRun{
		UserID:          userID,
		Status:          "running",
		Topic:           normalized.Topic,
		Difficulty:      normalized.Difficulty,
		ArticleLength:   normalized.ArticleLength,
		TargetWordCount: len(targets),
		PromptVersion:   promptVersionV1,
	})
	if err != nil {
		return GenerateResult{}, err
	}

	aiReq := buildAIRequest(normalized, targets, nil)
	var aiResp *ai.GenerateArticleResponse
	var words []ArticleWordDraft
	covered := 0
	attemptCount := 0
	inputTokens := 0
	outputTokens := 0
	modelName := ""
	for attempt := 0; attempt < 3; attempt++ {
		attemptCount++
		aiResp, err = s.ai.GenerateArticle(ctx, aiReq)
		if err != nil {
			s.failGenerationRun(ctx, run.ID, GenerationRunMetrics{
				Status:       "failed",
				ModelName:    modelName,
				AttemptCount: attemptCount,
				InputTokens:  inputTokens,
				OutputTokens: outputTokens,
				DurationMS:   time.Since(generationStarted).Milliseconds(),
				ErrorCode:    generationErrorCode(err),
			})
			return GenerateResult{}, err
		}
		inputTokens += aiResp.InputTokens
		outputTokens += aiResp.OutputTokens
		modelName = aiResp.ModelName
		aiResp.ContentMarkdown = stripMarkdownEmphasis(aiResp.ContentMarkdown)
		words, covered = locateCoverage(aiResp.ContentMarkdown, targets, aiResp.CoveredWords)
		if coverageRate(covered, len(targets)) >= 0.9 || attempt == 2 {
			break
		}
		aiReq.MissingWords = missingSpellings(words)
	}

	rate := coverageRate(covered, len(targets))
	status := "succeeded"
	if rate < 0.9 {
		status = "low_coverage"
	}
	durationMS := time.Since(generationStarted).Milliseconds()
	coverageDecimal := decimal.NewFromFloat(rate).Round(4)
	detail, err := s.repo.SaveGeneratedArticle(ctx, ArticleDraft{
		UserID:               userID,
		Title:                strings.TrimSpace(aiResp.Title),
		Topic:                normalized.Topic,
		Difficulty:           normalized.Difficulty,
		ArticleLength:        normalized.ArticleLength,
		ContentMarkdown:      aiResp.ContentMarkdown,
		Summary:              aiResp.Summary,
		GenerationParams:     buildGenerationParams(normalized, targets, len(selectedIDs) > 0),
		TargetWordCount:      len(targets),
		CoveredWordCount:     covered,
		CoverageRate:         coverageDecimal,
		GenerationStatus:     status,
		ModelName:            aiResp.ModelName,
		PromptVersion:        promptVersionV1,
		GenerationRunID:      run.ID,
		GenerationAttempts:   attemptCount,
		GenerationDurationMS: durationMS,
		InputTokens:          inputTokens,
		OutputTokens:         outputTokens,
		Words:                words,
	})
	if err != nil {
		s.failGenerationRun(ctx, run.ID, GenerationRunMetrics{
			Status:       "failed",
			ModelName:    modelName,
			AttemptCount: attemptCount,
			InputTokens:  inputTokens,
			OutputTokens: outputTokens,
			DurationMS:   durationMS,
			CoverageRate: coverageDecimal,
			ErrorCode:    "persistence_failed",
		})
		return GenerateResult{}, err
	}
	return GenerateResult{
		ArticleID:        detail.Article.ID,
		Status:           detail.Article.GenerationStatus,
		CoveredWordCount: detail.Article.CoveredWordCount,
		TargetWordCount:  detail.Article.TargetWordCount,
		CoverageRate:     rate,
	}, nil
}

func (s *Service) failGenerationRun(ctx context.Context, runID uuid.UUID, metrics GenerationRunMetrics) {
	_ = s.repo.FailGenerationRun(context.WithoutCancel(ctx), runID, metrics)
}

func generationErrorCode(err error) string {
	switch {
	case errors.Is(err, context.Canceled):
		return "request_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "request_deadline_exceeded"
	case errors.Is(err, ai.ErrAPIKeyMissing):
		return "ai_api_key_missing"
	case errors.Is(err, ai.ErrInvalidAIResponse):
		return "ai_invalid_response"
	case errors.Is(err, ai.ErrGenerationFailed):
		return "ai_generation_failed"
	default:
		return "generation_failed"
	}
}

func (s *Service) List(ctx context.Context, page, pageSize int) (PagedArticles, error) {
	page, pageSize, err := normalizePage(page, pageSize)
	if err != nil {
		return PagedArticles{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return PagedArticles{}, err
	}
	result, err := s.repo.ListArticles(ctx, userID, page, pageSize)
	if err != nil {
		return PagedArticles{}, err
	}
	return PagedArticles{Items: result.Items, Total: result.Total, Page: page, PageSize: pageSize}, nil
}

func (s *Service) ListGenerationRuns(ctx context.Context, limit int) ([]GenerationRunResponse, error) {
	if limit == 0 {
		limit = 20
	}
	if limit < 1 || limit > 100 {
		return nil, APIError{Status: 400, Code: "INVALID_QUERY", Message: "limit must be between 1 and 100"}
	}
	userID, err := localUserID()
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ListGenerationRuns(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	items := make([]GenerationRunResponse, 0, len(rows))
	for _, row := range rows {
		coverage, _ := row.CoverageRate.Float64()
		items = append(items, GenerationRunResponse{
			ID:              row.ID,
			ArticleID:       row.ArticleID,
			Status:          row.Status,
			Topic:           row.Topic,
			Difficulty:      row.Difficulty,
			ArticleLength:   row.ArticleLength,
			TargetWordCount: row.TargetWordCount,
			ModelName:       row.ModelName,
			PromptVersion:   row.PromptVersion,
			AttemptCount:    row.AttemptCount,
			InputTokens:     row.InputTokens,
			OutputTokens:    row.OutputTokens,
			DurationMS:      row.DurationMS,
			CoverageRate:    coverage,
			ErrorCode:       row.ErrorCode,
			CreatedAt:       row.CreatedAt,
		})
	}
	return items, nil
}

func (s *Service) Get(ctx context.Context, id string) (ArticleDetailResponse, error) {
	detail, err := s.getDetail(ctx, id)
	if err != nil {
		return ArticleDetailResponse{}, err
	}
	return mapArticleDetail(detail), nil
}

func (s *Service) getDetail(ctx context.Context, id string) (ArticleDetail, error) {
	articleID, err := uuid.Parse(id)
	if err != nil {
		return ArticleDetail{}, APIError{Status: 400, Code: "INVALID_ARTICLE_ID", Message: "article id must be a UUID"}
	}
	userID, err := localUserID()
	if err != nil {
		return ArticleDetail{}, err
	}
	return s.repo.GetArticle(ctx, userID, articleID)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	articleID, err := uuid.Parse(id)
	if err != nil {
		return APIError{Status: 400, Code: "INVALID_ARTICLE_ID", Message: "article id must be a UUID"}
	}
	userID, err := localUserID()
	if err != nil {
		return err
	}
	return s.repo.DeleteArticle(ctx, userID, articleID)
}

func (s *Service) GetProgress(ctx context.Context, id string) (ArticleProgressResponse, error) {
	detail, err := s.getDetail(ctx, id)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	progress, ok, err := s.repo.GetArticleProgress(ctx, userID, detail.Article.ID)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	if !ok {
		return ArticleProgressResponse{
			UserID:          userID,
			ArticleID:       detail.Article.ID,
			Status:          ArticleProgressUnread,
			ProgressPercent: 0,
		}, nil
	}
	return mapArticleProgress(progress), nil
}

func (s *Service) UpdateProgress(ctx context.Context, id string, req ArticleProgressRequest) (ArticleProgressResponse, error) {
	detail, err := s.getDetail(ctx, id)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	userID, err := localUserID()
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	previous, hasPrevious, err := s.repo.GetArticleProgress(ctx, userID, detail.Article.ID)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	progress, err := normalizeProgressRequest(userID, detail.Article.ID, req)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	recordExposures := progress.Status == ArticleProgressRead && (!hasPrevious || previous.Status != ArticleProgressRead)
	progress, err = s.repo.UpsertArticleProgressWithExposures(ctx, progress, recordExposures)
	if err != nil {
		return ArticleProgressResponse{}, err
	}
	return mapArticleProgress(progress), nil
}

func (s *Service) Regenerate(ctx context.Context, id string) (GenerateResult, error) {
	detail, err := s.getDetail(ctx, id)
	if err != nil {
		return GenerateResult{}, err
	}
	req, err := generateRequestFromParams(detail.Article)
	if err != nil {
		return GenerateResult{}, err
	}
	return s.Generate(ctx, req)
}

func (s *Service) ExportMarkdown(ctx context.Context, id string) (string, error) {
	detail, err := s.getDetail(ctx, id)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(detail.Article.Title)
	b.WriteString("\n\n")
	b.WriteString(detail.Article.ContentMarkdown)
	b.WriteString("\n\n## Target Words\n\n")
	sort.Slice(detail.Words, func(i, j int) bool { return detail.Words[i].Spelling < detail.Words[j].Spelling })
	for _, word := range detail.Words {
		mark := "- [ ] "
		if word.IsCovered {
			mark = "- [x] "
		}
		b.WriteString(mark)
		b.WriteString(word.Spelling)
		if word.Form != nil && *word.Form != "" && *word.Form != word.Spelling {
			b.WriteString(" (")
			b.WriteString(*word.Form)
			b.WriteString(")")
		}
		b.WriteString("\n")
	}
	return b.String(), nil
}

func mapArticleDetail(detail ArticleDetail) ArticleDetailResponse {
	coverage, _ := detail.Article.CoverageRate.Float64()
	return ArticleDetailResponse{
		Article: ArticleResponse{
			ID:                   detail.Article.ID,
			Title:                detail.Article.Title,
			Topic:                detail.Article.Topic,
			Difficulty:           detail.Article.Difficulty,
			ArticleLength:        detail.Article.ArticleLength,
			ContentMarkdown:      detail.Article.ContentMarkdown,
			Summary:              detail.Article.Summary,
			GenerationParams:     json.RawMessage(detail.Article.GenerationParams),
			TargetWordCount:      detail.Article.TargetWordCount,
			CoveredWordCount:     detail.Article.CoveredWordCount,
			CoverageRate:         coverage,
			GenerationStatus:     detail.Article.GenerationStatus,
			ModelName:            detail.Article.ModelName,
			PromptVersion:        detail.Article.PromptVersion,
			GenerationAttempts:   detail.Article.GenerationAttempts,
			GenerationDurationMS: detail.Article.GenerationDurationMS,
			InputTokens:          detail.Article.InputTokens,
			OutputTokens:         detail.Article.OutputTokens,
			CreatedAt:            detail.Article.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
		Words: detail.Words,
	}
}

func validateGenerateRequest(req GenerateRequest) (GenerateRequest, error) {
	req.Topic = strings.TrimSpace(req.Topic)
	req.Difficulty = strings.TrimSpace(req.Difficulty)
	req.ArticleLength = strings.TrimSpace(req.ArticleLength)
	if req.Topic == "" {
		return GenerateRequest{}, APIError{Status: 422, Code: "TOPIC_REQUIRED", Message: "topic is required"}
	}
	if utf8.RuneCountInString(req.Topic) > 128 {
		return GenerateRequest{}, APIError{Status: 422, Code: "TOPIC_TOO_LONG", Message: "topic must be 128 characters or fewer"}
	}
	if req.Difficulty == "" {
		return GenerateRequest{}, APIError{Status: 422, Code: "DIFFICULTY_REQUIRED", Message: "difficulty is required"}
	}
	switch req.Difficulty {
	case "A2", "B1", "B2", "B1-B2", "C1":
	default:
		return GenerateRequest{}, APIError{Status: 422, Code: "DIFFICULTY_INVALID", Message: "difficulty must be A2, B1, B2, B1-B2, or C1"}
	}
	if req.ArticleLength == "" {
		req.ArticleLength = "medium"
	}
	switch req.ArticleLength {
	case "short", "medium", "long":
	default:
		return GenerateRequest{}, APIError{Status: 422, Code: "ARTICLE_LENGTH_INVALID", Message: "article_length must be short, medium, or long"}
	}
	if err := validateTargetSelection(req.TargetWordCount, req.TargetWordIDs); err != nil {
		return GenerateRequest{}, err
	}
	return req, nil
}

func validateTargetSelection(targetWordCount int, targetWordIDs []string) error {
	if targetWordCount > 80 || len(targetWordIDs) > 80 {
		return APIError{
			Status:  422,
			Code:    "TARGET_WORDS_TOO_MANY",
			Message: "目标词数超过单篇上限 80。请拆分成多篇文章生成。",
			Details: map[string]any{"selected": len(targetWordIDs), "max_per_article": 80},
		}
	}
	if targetWordCount < 15 {
		return APIError{Status: 422, Code: "TARGET_WORD_COUNT_TOO_SMALL", Message: "target_word_count must be at least 15"}
	}
	if len(targetWordIDs) > targetWordCount {
		return APIError{
			Status:  422,
			Code:    "TARGET_WORDS_EXCEED_COUNT",
			Message: fmt.Sprintf("已勾选 %d 个词，超过目标词数 %d。请减少勾选或选择更长的文章长度。", len(targetWordIDs), targetWordCount),
			Details: map[string]any{"selected": len(targetWordIDs), "target_word_count": targetWordCount, "suggested_length": "long"},
		}
	}
	return nil
}

func parseUUIDs(ids []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		parsed, err := uuid.Parse(id)
		if err != nil {
			return nil, APIError{Status: 422, Code: "TARGET_WORD_ID_INVALID", Message: "target_word_ids must be UUIDs"}
		}
		out = append(out, parsed)
	}
	return out, nil
}

func uniqueUUIDCount(ids []uuid.UUID) int {
	seen := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		seen[id] = struct{}{}
	}
	return len(seen)
}

func hasTargetTag(tags []string, target string) bool {
	for _, tag := range tags {
		if strings.EqualFold(strings.TrimSpace(tag), target) {
			return true
		}
	}
	return false
}

type generationParams struct {
	Topic                 string                         `json:"topic"`
	Difficulty            string                         `json:"difficulty"`
	ArticleLength         string                         `json:"article_length"`
	TargetWordCount       int                            `json:"target_word_count"`
	TargetRecordIDs       []string                       `json:"target_record_ids"`
	TargetWordIDs         []string                       `json:"target_word_ids"`
	SelectionMode         string                         `json:"selection_mode"`
	SelectionVersion      string                         `json:"selection_version"`
	TargetRecommendations []targetRecommendationSnapshot `json:"target_recommendations"`
}

type targetRecommendationSnapshot struct {
	RecordID string         `json:"record_id"`
	WordID   string         `json:"word_id"`
	Score    int            `json:"score"`
	Reasons  map[string]int `json:"reasons"`
}

func buildGenerationParams(req GenerateRequest, targets []TargetWordRecord, manual bool) datatypes.JSON {
	params := generationParams{
		Topic:                 req.Topic,
		Difficulty:            req.Difficulty,
		ArticleLength:         req.ArticleLength,
		TargetWordCount:       len(targets),
		TargetRecordIDs:       make([]string, 0, len(targets)),
		TargetWordIDs:         make([]string, 0, len(targets)),
		SelectionMode:         "auto",
		SelectionVersion:      vocabulary.RecommendationVersionV2,
		TargetRecommendations: make([]targetRecommendationSnapshot, 0, len(targets)),
	}
	if manual {
		params.SelectionMode = "manual"
	}
	for _, target := range targets {
		params.TargetRecordIDs = append(params.TargetRecordIDs, target.RecordID.String())
		params.TargetWordIDs = append(params.TargetWordIDs, target.WordID.String())
		params.TargetRecommendations = append(params.TargetRecommendations, targetRecommendationSnapshot{
			RecordID: target.RecordID.String(),
			WordID:   target.WordID.String(),
			Score:    target.RecommendationScore,
			Reasons:  target.RecommendationReasons,
		})
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return datatypes.JSON([]byte(`{}`))
	}
	return datatypes.JSON(raw)
}

func generateRequestFromParams(article Article) (GenerateRequest, error) {
	var params generationParams
	if len(article.GenerationParams) > 0 {
		if err := json.Unmarshal(article.GenerationParams, &params); err != nil {
			return GenerateRequest{}, APIError{Status: 422, Code: "ARTICLE_GENERATION_PARAMS_INVALID", Message: "article generation parameters are invalid"}
		}
	}
	if params.Topic == "" {
		params.Topic = article.Topic
	}
	if params.Difficulty == "" {
		params.Difficulty = article.Difficulty
	}
	if params.ArticleLength == "" {
		params.ArticleLength = article.ArticleLength
	}
	if params.TargetWordCount == 0 {
		params.TargetWordCount = article.TargetWordCount
	}
	if len(params.TargetRecordIDs) == 0 {
		return GenerateRequest{}, APIError{Status: 422, Code: "ARTICLE_GENERATION_PARAMS_MISSING_TARGETS", Message: "article does not have a target word snapshot for regeneration"}
	}
	return GenerateRequest{
		Topic:           params.Topic,
		Difficulty:      params.Difficulty,
		ArticleLength:   params.ArticleLength,
		TargetWordCount: params.TargetWordCount,
		TargetWordIDs:   params.TargetRecordIDs,
	}, nil
}

func normalizeProgressRequest(userID, articleID uuid.UUID, req ArticleProgressRequest) (UserArticleProgress, error) {
	status := strings.TrimSpace(req.Status)
	progress := 0
	if req.ProgressPercent != nil {
		progress = *req.ProgressPercent
	}
	if status == "" {
		switch {
		case progress >= 100:
			status = ArticleProgressRead
		case progress > 0:
			status = ArticleProgressReading
		default:
			status = ArticleProgressUnread
		}
	}
	if status != ArticleProgressUnread && status != ArticleProgressReading && status != ArticleProgressRead {
		return UserArticleProgress{}, APIError{Status: 400, Code: "INVALID_ARTICLE_PROGRESS", Message: "status must be unread, reading, or read"}
	}
	if progress < 0 || progress > 100 {
		return UserArticleProgress{}, APIError{Status: 400, Code: "INVALID_ARTICLE_PROGRESS", Message: "progress_percent must be between 0 and 100"}
	}
	if req.LastParagraphIndex != nil && *req.LastParagraphIndex < 0 {
		return UserArticleProgress{}, APIError{Status: 400, Code: "INVALID_ARTICLE_PROGRESS", Message: "last_paragraph_index must be >= 0"}
	}
	now := time.Now()
	row := UserArticleProgress{
		UserID:             userID,
		ArticleID:          articleID,
		Status:             status,
		ProgressPercent:    progress,
		LastParagraphIndex: req.LastParagraphIndex,
	}
	switch status {
	case ArticleProgressUnread:
		row.ProgressPercent = 0
		row.LastParagraphIndex = nil
	case ArticleProgressReading:
		if row.ProgressPercent == 0 {
			row.ProgressPercent = 1
		}
		row.StartedAt = &now
	case ArticleProgressRead:
		row.ProgressPercent = 100
		row.StartedAt = &now
		row.CompletedAt = &now
	}
	return row, nil
}

func mapArticleProgress(row UserArticleProgress) ArticleProgressResponse {
	updatedAt := row.UpdatedAt
	return ArticleProgressResponse{
		ID:                 row.ID,
		UserID:             row.UserID,
		ArticleID:          row.ArticleID,
		Status:             row.Status,
		ProgressPercent:    row.ProgressPercent,
		LastParagraphIndex: row.LastParagraphIndex,
		StartedAt:          row.StartedAt,
		CompletedAt:        row.CompletedAt,
		UpdatedAt:          &updatedAt,
	}
}

func buildAIRequest(req GenerateRequest, targets []TargetWordRecord, missing []string) ai.GenerateArticleRequest {
	words := make([]ai.TargetWord, 0, len(targets))
	for _, target := range targets {
		words = append(words, ai.TargetWord{
			Word:         target.Spelling,
			LastResponse: target.LastResponse,
			StudyCount:   target.StudyCount,
			Tags:         target.Tags,
		})
	}
	return ai.GenerateArticleRequest{
		Topic:           req.Topic,
		Difficulty:      req.Difficulty,
		TargetWordCount: len(targets),
		ArticleLength:   req.ArticleLength,
		TargetWords:     words,
		PromptVersion:   promptVersionV1,
		MissingWords:    missing,
	}
}

func stripMarkdownEmphasis(content string) string {
	return markdownEmphasisRE.ReplaceAllString(content, "$1")
}

func locateCoverage(content string, targets []TargetWordRecord, claims []ai.CoveredWord) ([]ArticleWordDraft, int) {
	claimBySpelling := map[string]ai.CoveredWord{}
	for _, claim := range claims {
		key := strings.ToLower(strings.TrimSpace(claim.Spelling))
		if _, exists := claimBySpelling[key]; !exists {
			claimBySpelling[key] = claim
		}
	}

	words := make([]ArticleWordDraft, 0, len(targets))
	covered := 0
	for _, target := range targets {
		draft := ArticleWordDraft{WordID: target.WordID, Spelling: target.Spelling}
		claim, ok := claimBySpelling[strings.ToLower(target.Spelling)]
		if ok {
			if located, found := locateClaim(content, claim); found {
				draft = located
				draft.WordID = target.WordID
				draft.Spelling = target.Spelling
				covered++
				words = append(words, draft)
				continue
			}
		}
		if located, found := locateSpelling(content, target.Spelling); found {
			draft = located
			draft.WordID = target.WordID
			draft.Spelling = target.Spelling
			covered++
		}
		words = append(words, draft)
	}
	return words, covered
}

func locateClaim(content string, claim ai.CoveredWord) (ArticleWordDraft, bool) {
	occurrence := claim.Occurrence
	if occurrence < 1 {
		occurrence = 1
	}
	needle := claim.ContextBefore + claim.Form + claim.ContextAfter
	if needle == "" || claim.Form == "" {
		return ArticleWordDraft{}, false
	}
	byteStart := findNth(content, needle, occurrence)
	if byteStart < 0 {
		return ArticleWordDraft{}, false
	}
	formByteStart := byteStart + len(claim.ContextBefore)
	charOffset := len([]rune(content[:formByteStart]))
	charLength := len([]rune(claim.Form))
	form := claim.Form
	before := claim.ContextBefore
	after := claim.ContextAfter
	return ArticleWordDraft{
		Form:          &form,
		Occurrence:    &occurrence,
		ContextBefore: &before,
		ContextAfter:  &after,
		CharOffset:    &charOffset,
		CharLength:    &charLength,
		IsCovered:     true,
	}, true
}

func findNth(content, needle string, occurrence int) int {
	offset := 0
	for i := 0; i < occurrence; i++ {
		index := strings.Index(content[offset:], needle)
		if index < 0 {
			return -1
		}
		if i == occurrence-1 {
			return offset + index
		}
		offset += index + len(needle)
	}
	return -1
}

func locateSpelling(content, spelling string) (ArticleWordDraft, bool) {
	spelling = strings.TrimSpace(spelling)
	if content == "" || spelling == "" {
		return ArticleWordDraft{}, false
	}
	var byteStart int
	var form string
	for _, candidate := range spellingForms(spelling) {
		byteStart = findEmphasizedSpelling(content, candidate)
		if byteStart < 0 {
			byteStart = findWholeSpelling(content, candidate)
		}
		if byteStart >= 0 {
			form = candidate
			break
		}
	}
	if byteStart < 0 {
		return ArticleWordDraft{}, false
	}
	byteEnd := byteStart + len(form)
	if byteEnd > len(content) {
		return ArticleWordDraft{}, false
	}
	form = content[byteStart:byteEnd]
	occurrence := 1
	before, after := contextWindow(content, byteStart, byteEnd, 16)
	charOffset := len([]rune(content[:byteStart]))
	charLength := len([]rune(form))
	return ArticleWordDraft{
		Form:          &form,
		Occurrence:    &occurrence,
		ContextBefore: &before,
		ContextAfter:  &after,
		CharOffset:    &charOffset,
		CharLength:    &charLength,
		IsCovered:     true,
	}, true
}

func spellingForms(spelling string) []string {
	forms := []string{spelling}
	if !strings.HasSuffix(strings.ToLower(spelling), "s") {
		forms = append(forms, spelling+"s")
	}
	return forms
}

func findEmphasizedSpelling(content, form string) int {
	patterns := []string{"**" + form + "**", "*" + form + "*"}
	lowerContent := strings.ToLower(content)
	for _, pattern := range patterns {
		lowerPattern := strings.ToLower(pattern)
		if index := strings.Index(lowerContent, lowerPattern); index >= 0 {
			return index + strings.Index(pattern, form)
		}
	}
	return -1
}

func findWholeSpelling(content, form string) int {
	lowerContent := strings.ToLower(content)
	lowerSpelling := strings.ToLower(form)
	offset := 0
	for {
		index := strings.Index(lowerContent[offset:], lowerSpelling)
		if index < 0 {
			return -1
		}
		byteStart := offset + index
		byteEnd := byteStart + len(lowerSpelling)
		if isWordBoundary(lowerContent, byteStart, byteEnd) {
			return byteStart
		}
		offset = byteStart + len(lowerSpelling)
	}
}

func isWordBoundary(content string, byteStart, byteEnd int) bool {
	if byteStart > 0 {
		prev, _ := utf8.DecodeLastRuneInString(content[:byteStart])
		if isWordRune(prev) {
			return false
		}
	}
	if byteEnd < len(content) {
		next, _ := utf8.DecodeRuneInString(content[byteEnd:])
		if isWordRune(next) {
			return false
		}
	}
	return true
}

func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '\''
}

func contextWindow(content string, byteStart, byteEnd, size int) (string, string) {
	beforeRunes := []rune(content[:byteStart])
	afterRunes := []rune(content[byteEnd:])
	if len(beforeRunes) > size {
		beforeRunes = beforeRunes[len(beforeRunes)-size:]
	}
	if len(afterRunes) > size {
		afterRunes = afterRunes[:size]
	}
	return string(beforeRunes), string(afterRunes)
}

func missingSpellings(words []ArticleWordDraft) []string {
	missing := []string{}
	for _, word := range words {
		if !word.IsCovered {
			missing = append(missing, word.Spelling)
		}
	}
	return missing
}

func coverageRate(covered, total int) float64 {
	if total == 0 {
		return 0
	}
	return math.Round((float64(covered)/float64(total))*10000) / 10000
}

func normalizePage(page, pageSize int) (int, int, error) {
	if page == 0 {
		page = 1
	}
	if pageSize == 0 {
		pageSize = 20
	}
	if page < 1 {
		return 0, 0, APIError{Status: 400, Code: "INVALID_QUERY", Message: "page must be >= 1"}
	}
	if pageSize < 1 || pageSize > 100 {
		return 0, 0, APIError{Status: 400, Code: "INVALID_QUERY", Message: "page_size must be between 1 and 100"}
	}
	return page, pageSize, nil
}

func localUserID() (uuid.UUID, error) {
	id, err := uuid.Parse(user.LocalUserID)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("parse local user id: %w", err)
	}
	return id, nil
}
