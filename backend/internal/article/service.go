package article

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"lexiforge/backend/internal/ai"
	"lexiforge/backend/internal/user"
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
	SaveGeneratedArticle(ctx context.Context, draft ArticleDraft) (ArticleDetail, error)
	ListArticles(ctx context.Context, userID uuid.UUID, page, pageSize int) (ArticleListResult, error)
	GetArticle(ctx context.Context, userID, articleID uuid.UUID) (ArticleDetail, error)
	DeleteArticle(ctx context.Context, userID, articleID uuid.UUID) error
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

type PagedArticles struct {
	Items    []ArticleListItem `json:"items"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
}

type ArticleResponse struct {
	ID               uuid.UUID `json:"id"`
	Title            string    `json:"title"`
	Topic            string    `json:"topic"`
	Difficulty       string    `json:"difficulty"`
	ContentMarkdown  string    `json:"content_markdown"`
	Summary          string    `json:"summary"`
	TargetWordCount  int       `json:"target_word_count"`
	CoveredWordCount int       `json:"covered_word_count"`
	CoverageRate     float64   `json:"coverage_rate"`
	GenerationStatus string    `json:"generation_status"`
	ModelName        string    `json:"model_name"`
	PromptVersion    string    `json:"prompt_version"`
	CreatedAt        string    `json:"created_at"`
}

type ArticleDetailResponse struct {
	Article ArticleResponse `json:"article"`
	Words   []ArticleWord   `json:"words"`
}

type APIError struct {
	Status  int
	Code    string
	Message string
	Details any
}

func (e APIError) Error() string { return e.Code + ": " + e.Message }

var ErrAIGenerationUnavailable = errors.New("ai generation unavailable")

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

	aiReq := buildAIRequest(normalized, targets, nil)
	var aiResp *ai.GenerateArticleResponse
	var words []ArticleWordDraft
	covered := 0
	for attempt := 0; attempt < 3; attempt++ {
		aiResp, err = s.ai.GenerateArticle(ctx, aiReq)
		if err != nil {
			return GenerateResult{}, err
		}
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
	detail, err := s.repo.SaveGeneratedArticle(ctx, ArticleDraft{
		UserID:           userID,
		Title:            strings.TrimSpace(aiResp.Title),
		Topic:            normalized.Topic,
		Difficulty:       normalized.Difficulty,
		ContentMarkdown:  aiResp.ContentMarkdown,
		Summary:          aiResp.Summary,
		TargetWordCount:  len(targets),
		CoveredWordCount: covered,
		CoverageRate:     decimal.NewFromFloat(rate).Round(4),
		GenerationStatus: status,
		ModelName:        aiResp.ModelName,
		PromptVersion:    promptVersionV1,
		Words:            words,
	})
	if err != nil {
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
			ID:               detail.Article.ID,
			Title:            detail.Article.Title,
			Topic:            detail.Article.Topic,
			Difficulty:       detail.Article.Difficulty,
			ContentMarkdown:  detail.Article.ContentMarkdown,
			Summary:          detail.Article.Summary,
			TargetWordCount:  detail.Article.TargetWordCount,
			CoveredWordCount: detail.Article.CoveredWordCount,
			CoverageRate:     coverage,
			GenerationStatus: detail.Article.GenerationStatus,
			ModelName:        detail.Article.ModelName,
			PromptVersion:    detail.Article.PromptVersion,
			CreatedAt:        detail.Article.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
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
	if req.Difficulty == "" {
		return GenerateRequest{}, APIError{Status: 422, Code: "DIFFICULTY_REQUIRED", Message: "difficulty is required"}
	}
	if req.ArticleLength == "" {
		req.ArticleLength = "medium"
	}
	if req.TargetWordCount > 80 || len(req.TargetWordIDs) > 80 {
		return GenerateRequest{}, APIError{
			Status:  422,
			Code:    "TARGET_WORDS_TOO_MANY",
			Message: "目标词数超过单篇上限 80。请拆分成多篇文章生成。",
			Details: map[string]any{"selected": len(req.TargetWordIDs), "max_per_article": 80},
		}
	}
	if req.TargetWordCount < 15 {
		return GenerateRequest{}, APIError{Status: 422, Code: "TARGET_WORD_COUNT_TOO_SMALL", Message: "target_word_count must be at least 15"}
	}
	if len(req.TargetWordIDs) > req.TargetWordCount {
		return GenerateRequest{}, APIError{
			Status:  422,
			Code:    "TARGET_WORDS_EXCEED_COUNT",
			Message: fmt.Sprintf("已勾选 %d 个词，超过目标词数 %d。请减少勾选或选择更长的文章长度。", len(req.TargetWordIDs), req.TargetWordCount),
			Details: map[string]any{"selected": len(req.TargetWordIDs), "target_word_count": req.TargetWordCount, "suggested_length": "long"},
		}
	}
	return req, nil
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
