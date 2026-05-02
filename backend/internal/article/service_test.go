package article

import (
	"context"
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
	content := contentForTargets(targets)
	firstClaims := claimsForTargets(targets[:1], content)
	secondClaims := claimsForTargets(targets, content)
	repo := &fakeArticleRepo{targets: targets}
	aiClient := &fakeAIClient{resps: []*ai.GenerateArticleResponse{
		{Title: "First", ContentMarkdown: content, CoveredWords: firstClaims, MissingWords: []string{"word1"}},
		{Title: "Second", ContentMarkdown: content, CoveredWords: secondClaims, MissingWords: []string{}},
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
