package article

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"lexiforge/backend/internal/ai"
)

type fakeArticleRepo struct {
	targets []TargetWordRecord
	saved   ArticleDraft
}

func (f *fakeArticleRepo) SelectTargetWords(context.Context, uuid.UUID, []uuid.UUID, int) ([]TargetWordRecord, error) {
	return f.targets, nil
}

func (f *fakeArticleRepo) SaveGeneratedArticle(_ context.Context, draft ArticleDraft) (ArticleDetail, error) {
	f.saved = draft
	row := Article{
		ID:               uuid.New(),
		UserID:           draft.UserID,
		Title:            draft.Title,
		TargetWordCount:  draft.TargetWordCount,
		CoveredWordCount: draft.CoveredWordCount,
		GenerationStatus: draft.GenerationStatus,
	}
	return ArticleDetail{Article: row}, nil
}

func (f *fakeArticleRepo) ListArticles(context.Context, uuid.UUID, int, int) (ArticleListResult, error) {
	return ArticleListResult{}, nil
}

func (f *fakeArticleRepo) GetArticle(context.Context, uuid.UUID, uuid.UUID) (ArticleDetail, error) {
	return ArticleDetail{}, nil
}

func (f *fakeArticleRepo) DeleteArticle(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}

type fakeAIClient struct {
	calls    int
	requests []ai.GenerateArticleRequest
	resps    []*ai.GenerateArticleResponse
}

func (f *fakeAIClient) GenerateArticle(_ context.Context, req ai.GenerateArticleRequest) (*ai.GenerateArticleResponse, error) {
	f.calls++
	f.requests = append(f.requests, req)
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
		{Title: "First", ContentMarkdown: firstContent, CoveredWords: firstClaims, MissingWords: []string{"word1"}},
		{Title: "Second", ContentMarkdown: secondContent, CoveredWords: secondClaims, MissingWords: []string{}},
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
