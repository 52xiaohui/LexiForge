package article

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"lexiforge/backend/internal/ai"
	"lexiforge/backend/internal/vocabulary"
)

type fakeArticleRepo struct {
	targets        []TargetWordRecord
	selectedIDs    []uuid.UUID
	saved          ArticleDraft
	detail         ArticleDetail
	progress       UserArticleProgress
	hasProgress    bool
	exposureWrites int
	generationRuns []ArticleGenerationRun
	failedMetrics  GenerationRunMetrics
}

func (f *fakeArticleRepo) SelectTargetWords(_ context.Context, _ uuid.UUID, selectedIDs []uuid.UUID, _ int) ([]TargetWordRecord, error) {
	f.selectedIDs = selectedIDs
	return f.targets, nil
}

func (f *fakeArticleRepo) SaveGeneratedArticle(_ context.Context, draft ArticleDraft) (ArticleDetail, error) {
	f.saved = draft
	row := Article{
		ID:                   uuid.New(),
		UserID:               draft.UserID,
		Title:                draft.Title,
		Topic:                draft.Topic,
		Difficulty:           draft.Difficulty,
		ArticleLength:        draft.ArticleLength,
		GenerationParams:     draft.GenerationParams,
		TargetWordCount:      draft.TargetWordCount,
		CoveredWordCount:     draft.CoveredWordCount,
		GenerationStatus:     draft.GenerationStatus,
		GenerationAttempts:   draft.GenerationAttempts,
		GenerationDurationMS: draft.GenerationDurationMS,
		InputTokens:          draft.InputTokens,
		OutputTokens:         draft.OutputTokens,
	}
	return ArticleDetail{Article: row}, nil
}

func (f *fakeArticleRepo) StartGenerationRun(_ context.Context, run ArticleGenerationRun) (ArticleGenerationRun, error) {
	run.ID = uuid.New()
	f.generationRuns = append(f.generationRuns, run)
	return run, nil
}

func (f *fakeArticleRepo) FailGenerationRun(_ context.Context, _ uuid.UUID, metrics GenerationRunMetrics) error {
	f.failedMetrics = metrics
	return nil
}

func (f *fakeArticleRepo) ListGenerationRuns(context.Context, uuid.UUID, int) ([]ArticleGenerationRun, error) {
	return f.generationRuns, nil
}

func (f *fakeArticleRepo) ListArticles(context.Context, uuid.UUID, int, int) (ArticleListResult, error) {
	return ArticleListResult{}, nil
}

func (f *fakeArticleRepo) GetArticle(context.Context, uuid.UUID, uuid.UUID) (ArticleDetail, error) {
	return f.detail, nil
}

func (f *fakeArticleRepo) DeleteArticle(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}

func (f *fakeArticleRepo) GetArticleProgress(context.Context, uuid.UUID, uuid.UUID) (UserArticleProgress, bool, error) {
	return f.progress, f.hasProgress, nil
}

func (f *fakeArticleRepo) UpsertArticleProgressWithExposures(_ context.Context, progress UserArticleProgress, recordExposures bool) (UserArticleProgress, error) {
	f.progress = progress
	f.hasProgress = true
	f.progress.ID = uuid.New()
	if recordExposures {
		f.exposureWrites++
	}
	return f.progress, nil
}

type fakeAIClient struct {
	calls    int
	requests []ai.GenerateArticleRequest
	resps    []*ai.GenerateArticleResponse
	errs     []error
}

func (f *fakeAIClient) GenerateArticle(_ context.Context, req ai.GenerateArticleRequest) (*ai.GenerateArticleResponse, error) {
	f.calls++
	f.requests = append(f.requests, req)
	if len(f.errs) >= f.calls && f.errs[f.calls-1] != nil {
		return nil, f.errs[f.calls-1]
	}
	return f.resps[f.calls-1], nil
}

func TestGenerateRetriesLowCoverageAndSavesAllTargetWords(t *testing.T) {
	targets := makeTargets(15)
	firstContent := contentForTargets(targets[:1])
	secondContent := contentForTargets(targets)
	firstClaims := claimsForTargets(targets[:1], firstContent)
	secondClaims := claimsForTargets(targets, secondContent)
	repo := &fakeArticleRepo{targets: targets}
	aiClient := &fakeAIClient{resps: []*ai.GenerateArticleResponse{
		{Title: "First", ContentMarkdown: firstContent, CoveredWords: firstClaims, MissingWords: []string{"word1"}, ModelName: "test-model", InputTokens: 10, OutputTokens: 20},
		{Title: "Second", ContentMarkdown: secondContent, CoveredWords: secondClaims, MissingWords: []string{}, ModelName: "test-model", InputTokens: 3, OutputTokens: 4},
	}}
	svc := NewService(repo, aiClient)

	got, err := svc.Generate(context.Background(), GenerateRequest{
		Topic:           "campus life",
		Difficulty:      "B1-B2",
		ArticleLength:   "medium",
		TargetWordCount: 15,
	})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	if aiClient.calls != 2 {
		t.Fatalf("AI calls = %d, want 2", aiClient.calls)
	}
	if len(aiClient.requests[1].MissingWords) != 14 {
		t.Fatalf("retry missing words = %d, want 14", len(aiClient.requests[1].MissingWords))
	}
	if got.Status != "succeeded" || got.CoveredWordCount != 15 || got.CoverageRate != 1 {
		t.Fatalf("result = %#v, want full coverage success", got)
	}
	if len(repo.saved.Words) != 15 {
		t.Fatalf("saved words = %d, want 15", len(repo.saved.Words))
	}
	if repo.saved.ArticleLength != "medium" {
		t.Fatalf("saved article length = %q, want medium", repo.saved.ArticleLength)
	}
	params := decodeGenerationParams(t, repo.saved.GenerationParams)
	if params.Topic != "campus life" || params.Difficulty != "B1-B2" || params.ArticleLength != "medium" {
		t.Fatalf("generation params = %#v, want request fields persisted", params)
	}
	if params.TargetWordCount != 15 || len(params.TargetRecordIDs) != 15 || len(params.TargetWordIDs) != 15 {
		t.Fatalf("generation params target snapshot = %#v, want 15 final targets", params)
	}
	if params.SelectionVersion != vocabulary.RecommendationVersionV2 || len(params.TargetRecommendations) != 15 {
		t.Fatalf("selection snapshot = %#v, want recommendation v2 with 15 targets", params)
	}
	if repo.saved.GenerationAttempts != 2 || repo.saved.InputTokens != 13 || repo.saved.OutputTokens != 24 {
		t.Fatalf("generation metrics = attempts %d tokens %d/%d, want 2 and 13/24", repo.saved.GenerationAttempts, repo.saved.InputTokens, repo.saved.OutputTokens)
	}
}

func TestPreviewReturnsExactRepositorySelectionAndRecommendationReasons(t *testing.T) {
	targets := makeTargets(15)
	targets[0].RecommendationScore = 145
	targets[0].RecommendationVersion = vocabulary.RecommendationVersionV2
	targets[0].RecommendationReasons = map[string]int{"failed_in_context": 35}
	repo := &fakeArticleRepo{targets: targets}
	svc := NewService(repo, &fakeAIClient{})

	got, err := svc.Preview(context.Background(), PreviewRequest{TargetWordCount: 15})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(got.Words) != 15 || !got.IsAuto || got.AutoFillCount != 15 {
		t.Fatalf("preview = %#v, want 15 auto-selected words", got)
	}
	if got.Words[0].RecommendationScore != 145 || got.Words[0].RecommendationReasons["failed_in_context"] != 35 {
		t.Fatalf("first preview word = %#v, want recommendation explanation", got.Words[0])
	}
}

func TestGenerateRecordsAIFailureMetrics(t *testing.T) {
	targets := makeTargets(15)
	repo := &fakeArticleRepo{targets: targets}
	aiClient := &fakeAIClient{errs: []error{ai.ErrGenerationFailed}}
	svc := NewService(repo, aiClient)

	_, err := svc.Generate(context.Background(), GenerateRequest{
		Topic: "campus life", Difficulty: "B1", ArticleLength: "short", TargetWordCount: 15,
	})
	if !errors.Is(err, ai.ErrGenerationFailed) {
		t.Fatalf("Generate error = %v, want ai generation failure", err)
	}
	if repo.failedMetrics.Status != "failed" || repo.failedMetrics.AttemptCount != 1 || repo.failedMetrics.ErrorCode != "ai_generation_failed" {
		t.Fatalf("failure metrics = %#v, want classified first-attempt failure", repo.failedMetrics)
	}
}

func TestGeneratePersistsManualSelectionMode(t *testing.T) {
	targets := makeTargets(15)
	selectedID := targets[0].RecordID.String()
	content := contentForTargets(targets)
	repo := &fakeArticleRepo{targets: targets}
	aiClient := &fakeAIClient{resps: []*ai.GenerateArticleResponse{
		{Title: "Manual", ContentMarkdown: content, CoveredWords: claimsForTargets(targets, content), MissingWords: []string{}},
	}}
	svc := NewService(repo, aiClient)

	_, err := svc.Generate(context.Background(), GenerateRequest{
		Topic:           "campus life",
		Difficulty:      "B1",
		ArticleLength:   "short",
		TargetWordCount: 15,
		TargetWordIDs:   []string{selectedID},
	})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if len(repo.selectedIDs) != 1 || repo.selectedIDs[0] != targets[0].RecordID {
		t.Fatalf("selected IDs = %#v, want first target record id", repo.selectedIDs)
	}
	params := decodeGenerationParams(t, repo.saved.GenerationParams)
	if params.SelectionMode != "manual" {
		t.Fatalf("selection mode = %q, want manual", params.SelectionMode)
	}
	if params.TargetRecordIDs[0] != targets[0].RecordID.String() {
		t.Fatalf("first target record id = %q, want %s", params.TargetRecordIDs[0], targets[0].RecordID)
	}
}

func TestRegenerateReusesStoredGenerationParams(t *testing.T) {
	targets := makeTargets(15)
	content := contentForTargets(targets)
	sourceParams := buildGenerationParams(GenerateRequest{
		Topic:           "campus life",
		Difficulty:      "B1",
		ArticleLength:   "short",
		TargetWordCount: 15,
	}, targets, true)
	repo := &fakeArticleRepo{
		targets: targets,
		detail: ArticleDetail{Article: Article{
			ID:               uuid.New(),
			Topic:            "fallback topic",
			Difficulty:       "B2",
			ArticleLength:    "medium",
			TargetWordCount:  15,
			GenerationParams: sourceParams,
		}},
	}
	aiClient := &fakeAIClient{resps: []*ai.GenerateArticleResponse{
		{Title: "Regenerated", ContentMarkdown: content, CoveredWords: claimsForTargets(targets, content), MissingWords: []string{}},
	}}
	svc := NewService(repo, aiClient)

	got, err := svc.Regenerate(context.Background(), uuid.NewString())
	if err != nil {
		t.Fatalf("Regenerate returned error: %v", err)
	}
	if got.Status != "succeeded" || got.CoveredWordCount != 15 {
		t.Fatalf("result = %#v, want regenerated success", got)
	}
	if len(repo.selectedIDs) != len(targets) {
		t.Fatalf("selected IDs = %d, want %d", len(repo.selectedIDs), len(targets))
	}
	for i, id := range repo.selectedIDs {
		if id != targets[i].RecordID {
			t.Fatalf("selected ID[%d] = %s, want %s", i, id, targets[i].RecordID)
		}
	}
	if repo.saved.Topic != "campus life" || repo.saved.Difficulty != "B1" || repo.saved.ArticleLength != "short" {
		t.Fatalf("saved request fields = topic %q difficulty %q length %q, want stored generation params", repo.saved.Topic, repo.saved.Difficulty, repo.saved.ArticleLength)
	}
}

func TestRegenerateRequiresTargetSnapshot(t *testing.T) {
	repo := &fakeArticleRepo{
		detail: ArticleDetail{Article: Article{
			ID:               uuid.New(),
			Topic:            "campus life",
			Difficulty:       "B1",
			ArticleLength:    "medium",
			TargetWordCount:  15,
			GenerationParams: []byte(`{}`),
		}},
	}
	svc := NewService(repo, &fakeAIClient{})

	_, err := svc.Regenerate(context.Background(), uuid.NewString())
	var apiErr APIError
	if err == nil || !asAPIError(err, &apiErr) {
		t.Fatalf("error = %v, want APIError", err)
	}
	if apiErr.Code != "ARTICLE_GENERATION_PARAMS_MISSING_TARGETS" {
		t.Fatalf("code = %s, want ARTICLE_GENERATION_PARAMS_MISSING_TARGETS", apiErr.Code)
	}
}

func TestGetProgressDefaultsToUnread(t *testing.T) {
	articleID := uuid.New()
	repo := &fakeArticleRepo{
		detail: ArticleDetail{Article: Article{ID: articleID}},
	}
	svc := NewService(repo, &fakeAIClient{})

	got, err := svc.GetProgress(context.Background(), articleID.String())
	if err != nil {
		t.Fatalf("GetProgress returned error: %v", err)
	}
	if got.ArticleID != articleID || got.Status != ArticleProgressUnread || got.ProgressPercent != 0 {
		t.Fatalf("progress = %#v, want default unread for article", got)
	}
}

func TestUpdateProgressMarksArticleRead(t *testing.T) {
	articleID := uuid.New()
	repo := &fakeArticleRepo{
		detail: ArticleDetail{Article: Article{ID: articleID}},
	}
	svc := NewService(repo, &fakeAIClient{})

	got, err := svc.UpdateProgress(context.Background(), articleID.String(), ArticleProgressRequest{
		Status: ArticleProgressRead,
	})
	if err != nil {
		t.Fatalf("UpdateProgress returned error: %v", err)
	}
	if got.Status != ArticleProgressRead || got.ProgressPercent != 100 {
		t.Fatalf("progress = %#v, want read at 100%%", got)
	}
	if repo.progress.CompletedAt == nil {
		t.Fatalf("completed_at = nil, want set")
	}
	if repo.exposureWrites != 1 {
		t.Fatalf("exposure writes = %d, want 1", repo.exposureWrites)
	}
}

func TestUpdateProgressDoesNotDuplicateReadExposures(t *testing.T) {
	articleID := uuid.New()
	repo := &fakeArticleRepo{
		detail:      ArticleDetail{Article: Article{ID: articleID}},
		progress:    UserArticleProgress{ArticleID: articleID, Status: ArticleProgressRead, ProgressPercent: 100},
		hasProgress: true,
	}
	svc := NewService(repo, &fakeAIClient{})

	_, err := svc.UpdateProgress(context.Background(), articleID.String(), ArticleProgressRequest{
		Status: ArticleProgressRead,
	})
	if err != nil {
		t.Fatalf("UpdateProgress returned error: %v", err)
	}
	if repo.exposureWrites != 0 {
		t.Fatalf("exposure writes = %d, want 0 for already-read article", repo.exposureWrites)
	}
}

func TestGenerateStripsMarkdownEmphasisBeforeSavingAndLocating(t *testing.T) {
	targets := makeTargets(15)
	rawContent := emphasizedContentForTargets(targets)
	repo := &fakeArticleRepo{targets: targets}
	aiClient := &fakeAIClient{resps: []*ai.GenerateArticleResponse{
		{Title: "Emphasized", ContentMarkdown: rawContent, CoveredWords: nil, MissingWords: []string{}},
	}}
	svc := NewService(repo, aiClient)

	got, err := svc.Generate(context.Background(), GenerateRequest{
		Topic:           "campus life",
		Difficulty:      "B1-B2",
		ArticleLength:   "medium",
		TargetWordCount: 15,
	})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	if got.Status != "succeeded" || got.CoveredWordCount != 15 {
		t.Fatalf("result = %#v, want sanitized full coverage success", got)
	}
	if strings.Contains(repo.saved.ContentMarkdown, "*") {
		t.Fatalf("saved content still contains Markdown emphasis: %q", repo.saved.ContentMarkdown)
	}
	if repo.saved.ContentMarkdown != contentForTargets(targets) {
		t.Fatalf("saved content = %q, want %q", repo.saved.ContentMarkdown, contentForTargets(targets))
	}
	first := repo.saved.Words[0]
	if !first.IsCovered || first.CharOffset == nil || *first.CharOffset != 0 {
		t.Fatalf("first word = %#v, want located at sanitized offset 0", first)
	}
}

func TestValidateGenerateRequestTargetWordsExceedCount(t *testing.T) {
	_, err := validateGenerateRequest(GenerateRequest{
		Topic:           "topic",
		Difficulty:      "B1",
		TargetWordCount: 15,
		TargetWordIDs:   make([]string, 16),
	})
	var apiErr APIError
	if err == nil || !asAPIError(err, &apiErr) {
		t.Fatalf("error = %v, want APIError", err)
	}
	if apiErr.Code != "TARGET_WORDS_EXCEED_COUNT" {
		t.Fatalf("code = %s, want TARGET_WORDS_EXCEED_COUNT", apiErr.Code)
	}
}

func TestValidateGenerateRequestRejectsUnsupportedDifficultyAndLength(t *testing.T) {
	for _, request := range []GenerateRequest{
		{Topic: "topic", Difficulty: "expert", ArticleLength: "short", TargetWordCount: 15},
		{Topic: "topic", Difficulty: "B1", ArticleLength: "novel", TargetWordCount: 15},
	} {
		if _, err := validateGenerateRequest(request); err == nil {
			t.Fatalf("validateGenerateRequest(%#v) returned nil error", request)
		}
	}
}

func TestLocateClaimUsesUnicodeCodePointOffsets(t *testing.T) {
	content := "A 😀 remarkable competence in tasks"
	form := "competence"
	got, ok := locateClaim(content, ai.CoveredWord{
		Spelling:      "competent",
		Form:          form,
		Occurrence:    1,
		ContextBefore: "A 😀 remarkable ",
		ContextAfter:  " in tasks",
	})
	if !ok {
		t.Fatalf("locateClaim returned false")
	}
	wantOffset := len([]rune("A 😀 remarkable "))
	if got.CharOffset == nil || *got.CharOffset != wantOffset {
		t.Fatalf("CharOffset = %v, want %d", got.CharOffset, wantOffset)
	}
	if got.CharLength == nil || *got.CharLength != len([]rune(form)) {
		t.Fatalf("CharLength = %v, want %d", got.CharLength, len([]rune(form)))
	}
}

func TestLocateCoverageFallsBackToBoldSpelling(t *testing.T) {
	wordID := uuid.New()
	words, covered := locateCoverage("Students joined a **campaign** today.", []TargetWordRecord{
		{WordID: wordID, Spelling: "campaign"},
	}, nil)
	if covered != 1 || len(words) != 1 || !words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want one covered word", covered, words)
	}
	if words[0].CharOffset == nil || *words[0].CharOffset != len([]rune("Students joined a **")) {
		t.Fatalf("CharOffset = %v, want bold spelling offset", words[0].CharOffset)
	}
}

func TestLocateCoverageVerifiesClaimBeforeCounting(t *testing.T) {
	target := TargetWordRecord{WordID: uuid.New(), Spelling: "fund"}
	badClaims := []ai.CoveredWord{{
		Spelling:      "fund",
		Form:          "fund",
		Occurrence:    1,
		ContextBefore: "wrong ",
		ContextAfter:  " context",
	}}

	words, covered := locateCoverage("The fundraising drive did not use the target.", []TargetWordRecord{target}, badClaims)
	if covered != 0 || len(words) != 1 || words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want bad claim rejected", covered, words)
	}

	words, covered = locateCoverage("The drive will **fund** the center.", []TargetWordRecord{target}, badClaims)
	if covered != 1 || !words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want fallback to actual content", covered, words)
	}
}

func TestLocateCoverageFallbackUsesWordBoundaries(t *testing.T) {
	target := TargetWordRecord{WordID: uuid.New(), Spelling: "fund"}
	words, covered := locateCoverage("The fundraising drive did not use the target.", []TargetWordRecord{target}, nil)
	if covered != 0 || len(words) != 1 || words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want no substring coverage", covered, words)
	}
	words, covered = locateCoverage("The fundraising drive will **fund** the center.", []TargetWordRecord{target}, nil)
	if covered != 1 || !words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want bold whole-word coverage", covered, words)
	}
}

func TestLocateCoverageFallbackAcceptsSimplePluralForm(t *testing.T) {
	target := TargetWordRecord{WordID: uuid.New(), Spelling: "pound"}
	words, covered := locateCoverage("The project received fifty thousand **pounds**.", []TargetWordRecord{target}, nil)
	if covered != 1 || len(words) != 1 || !words[0].IsCovered {
		t.Fatalf("coverage = %d, words = %#v, want plural form coverage", covered, words)
	}
	if words[0].Form == nil || *words[0].Form != "pounds" {
		t.Fatalf("form = %v, want pounds", words[0].Form)
	}
}

func makeTargets(n int) []TargetWordRecord {
	targets := make([]TargetWordRecord, 0, n)
	for i := 0; i < n; i++ {
		targets = append(targets, TargetWordRecord{
			RecordID:     uuid.New(),
			WordID:       uuid.New(),
			Spelling:     "word" + string(rune('a'+i)),
			LastResponse: "FORGET",
			StudyCount:   10,
		})
	}
	return targets
}

func contentForTargets(targets []TargetWordRecord) string {
	out := ""
	for i, target := range targets {
		if i > 0 {
			out += " "
		}
		out += target.Spelling
	}
	return out
}

func emphasizedContentForTargets(targets []TargetWordRecord) string {
	out := contentForTargets(targets)
	out = strings.Replace(out, targets[0].Spelling, "**"+targets[0].Spelling+"**", 1)
	out = strings.Replace(out, targets[1].Spelling, "*"+targets[1].Spelling+"*", 1)
	return out
}

func claimsForTargets(targets []TargetWordRecord, content string) []ai.CoveredWord {
	claims := make([]ai.CoveredWord, 0, len(targets))
	for i, target := range targets {
		after := ""
		if i < len(targets)-1 {
			after = " "
		}
		claims = append(claims, ai.CoveredWord{
			Spelling:     target.Spelling,
			Form:         target.Spelling,
			Occurrence:   1,
			ContextAfter: after,
		})
	}
	return claims
}

func asAPIError(err error, target *APIError) bool {
	if apiErr, ok := err.(APIError); ok {
		*target = apiErr
		return true
	}
	return false
}

func decodeGenerationParams(t *testing.T, raw []byte) generationParams {
	t.Helper()
	var params generationParams
	if err := json.Unmarshal(raw, &params); err != nil {
		t.Fatalf("decode generation params: %v; raw=%s", err, string(raw))
	}
	return params
}
