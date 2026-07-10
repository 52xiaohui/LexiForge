package article

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"lexiforge/backend/internal/vocabulary"
)

// Repository owns the GORM access for articles + article_words.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

type TargetWordRecord struct {
	RecordID              uuid.UUID
	WordID                uuid.UUID
	Spelling              string
	LastResponse          string
	StudyCount            int
	Tags                  []string
	WeakScore             int
	MasteryScore          int
	LastStudyDate         *time.Time
	NextStudyDate         *time.Time
	Pinned                bool
	LastRecognizedAt      *time.Time
	LastFailedAt          *time.Time
	LastExposedAt         *time.Time
	RecommendationScore   int
	RecommendationVersion string
	RecommendationReasons map[string]int
}

type ArticleDraft struct {
	UserID               uuid.UUID
	Title                string
	Topic                string
	Difficulty           string
	ArticleLength        string
	ContentMarkdown      string
	Summary              string
	GenerationParams     datatypes.JSON
	TargetWordCount      int
	CoveredWordCount     int
	CoverageRate         decimal.Decimal
	GenerationStatus     string
	ModelName            string
	PromptVersion        string
	GenerationRunID      uuid.UUID
	GenerationAttempts   int
	GenerationDurationMS int64
	InputTokens          int
	OutputTokens         int
	Words                []ArticleWordDraft
}

type GenerationRunMetrics struct {
	Status       string
	ModelName    string
	AttemptCount int
	InputTokens  int
	OutputTokens int
	DurationMS   int64
	CoverageRate decimal.Decimal
	ErrorCode    string
}

type ArticleWordDraft struct {
	WordID        uuid.UUID
	Spelling      string
	Form          *string
	Occurrence    *int
	ContextBefore *string
	ContextAfter  *string
	CharOffset    *int
	CharLength    *int
	IsCovered     bool
}

type ArticleDetail struct {
	Article Article       `json:"article"`
	Words   []ArticleWord `json:"words"`
}

type ArticleListItem struct {
	ID                 uuid.UUID `json:"id"`
	Title              string    `json:"title"`
	Topic              string    `json:"topic"`
	Difficulty         string    `json:"difficulty"`
	ArticleLength      string    `json:"article_length"`
	Summary            string    `json:"summary"`
	TargetWordCount    int       `json:"target_word_count"`
	CoveredWordCount   int       `json:"covered_word_count"`
	CoverageRate       float64   `json:"coverage_rate"`
	GenerationStatus   string    `json:"generation_status"`
	ModelName          string    `json:"model_name"`
	CreatedAt          time.Time `json:"created_at"`
	ProgressStatus     *string   `json:"progress_status,omitempty"`
	ProgressPercent    int       `json:"progress_percent"`
	LastParagraphIndex *int      `json:"last_paragraph_index,omitempty"`
}

type ArticleListResult struct {
	Items []ArticleListItem
	Total int64
}

var ErrArticleNotFound = errors.New("article not found")

const (
	autoPickMinWeakScore  = 50
	autoPickMaxMastery    = 60
	eventExposedInArticle = "exposed_in_article"
)

func (r *Repository) SelectTargetWords(ctx context.Context, userID uuid.UUID, selectedIDs []uuid.UUID, targetCount int) ([]TargetWordRecord, error) {
	selected := make([]TargetWordRecord, 0, len(selectedIDs))
	seenWords := map[uuid.UUID]struct{}{}

	if len(selectedIDs) > 0 {
		rows, err := r.findTargetWords(ctx, userID, "sr.id IN ?", []any{selectedIDs}, false)
		if err != nil {
			return nil, err
		}
		byID := map[uuid.UUID]TargetWordRecord{}
		for _, row := range rows {
			byID[row.RecordID] = row
		}
		for _, id := range selectedIDs {
			row, ok := byID[id]
			if !ok {
				return nil, fmt.Errorf("selected target word %s not found for local user", id)
			}
			if _, exists := seenWords[row.WordID]; exists {
				continue
			}
			selected = append(selected, row)
			seenWords[row.WordID] = struct{}{}
		}
	}

	targets := append([]TargetWordRecord(nil), selected...)
	if len(targets) >= targetCount {
		return targets, nil
	}

	candidates, err := r.findTargetWords(ctx, userID, "1 = 1", nil, true)
	if err != nil {
		return nil, err
	}
	sortTargetWords(candidates)

	appendPlan := func(limit int, matches func(TargetWordRecord) bool) {
		if limit <= 0 {
			return
		}
		added := 0
		for _, row := range candidates {
			if len(targets) >= targetCount || added >= limit {
				break
			}
			if _, exists := seenWords[row.WordID]; exists {
				continue
			}
			if !matches(row) {
				continue
			}
			targets = append(targets, row)
			seenWords[row.WordID] = struct{}{}
			added++
		}
	}

	appendPlan(quota(targetCount, 70)-len(selected), isPriorityTarget)
	appendPlan(quota(targetCount, 20), func(row TargetWordRecord) bool {
		return row.MasteryScore >= 45 && row.MasteryScore <= 80
	})
	appendPlan(targetCount-len(targets), func(row TargetWordRecord) bool {
		return row.LastStudyDate != nil
	})
	appendPlan(targetCount-len(targets), func(TargetWordRecord) bool { return true })
	return targets, nil
}

func (r *Repository) StartGenerationRun(ctx context.Context, run ArticleGenerationRun) (ArticleGenerationRun, error) {
	if err := r.db.WithContext(ctx).Create(&run).Error; err != nil {
		return ArticleGenerationRun{}, err
	}
	return run, nil
}

func (r *Repository) FailGenerationRun(ctx context.Context, runID uuid.UUID, metrics GenerationRunMetrics) error {
	return r.db.WithContext(ctx).Model(&ArticleGenerationRun{}).
		Where("id = ?", runID).
		Updates(generationRunUpdates(nil, metrics)).Error
}

func (r *Repository) ListGenerationRuns(ctx context.Context, userID uuid.UUID, limit int) ([]ArticleGenerationRun, error) {
	var rows []ArticleGenerationRun
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *Repository) SaveGeneratedArticle(ctx context.Context, draft ArticleDraft) (ArticleDetail, error) {
	var detail ArticleDetail
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row := Article{
			UserID:               draft.UserID,
			Title:                draft.Title,
			Topic:                draft.Topic,
			Difficulty:           draft.Difficulty,
			ArticleLength:        draft.ArticleLength,
			ContentMarkdown:      draft.ContentMarkdown,
			Summary:              draft.Summary,
			GenerationParams:     draft.GenerationParams,
			TargetWordCount:      draft.TargetWordCount,
			CoveredWordCount:     draft.CoveredWordCount,
			CoverageRate:         draft.CoverageRate,
			GenerationStatus:     draft.GenerationStatus,
			ModelName:            draft.ModelName,
			PromptVersion:        draft.PromptVersion,
			GenerationAttempts:   draft.GenerationAttempts,
			GenerationDurationMS: draft.GenerationDurationMS,
			InputTokens:          draft.InputTokens,
			OutputTokens:         draft.OutputTokens,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		words := make([]ArticleWord, 0, len(draft.Words))
		for _, word := range draft.Words {
			words = append(words, ArticleWord{
				ArticleID:     row.ID,
				WordID:        word.WordID,
				Spelling:      word.Spelling,
				Form:          word.Form,
				Occurrence:    word.Occurrence,
				ContextBefore: word.ContextBefore,
				ContextAfter:  word.ContextAfter,
				CharOffset:    word.CharOffset,
				CharLength:    word.CharLength,
				IsCovered:     word.IsCovered,
			})
		}
		if len(words) > 0 {
			if err := tx.Create(&words).Error; err != nil {
				return err
			}
		}
		if draft.GenerationRunID != uuid.Nil {
			articleID := row.ID
			metrics := GenerationRunMetrics{
				Status:       draft.GenerationStatus,
				ModelName:    draft.ModelName,
				AttemptCount: draft.GenerationAttempts,
				InputTokens:  draft.InputTokens,
				OutputTokens: draft.OutputTokens,
				DurationMS:   draft.GenerationDurationMS,
				CoverageRate: draft.CoverageRate,
			}
			result := tx.Model(&ArticleGenerationRun{}).
				Where("id = ? AND user_id = ?", draft.GenerationRunID, draft.UserID).
				Updates(generationRunUpdates(&articleID, metrics))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return fmt.Errorf("generation run %s not found", draft.GenerationRunID)
			}
		}
		detail = ArticleDetail{Article: row, Words: words}
		return nil
	})
	return detail, err
}

func generationRunUpdates(articleID *uuid.UUID, metrics GenerationRunMetrics) map[string]any {
	return map[string]any{
		"article_id":    articleID,
		"status":        metrics.Status,
		"model_name":    metrics.ModelName,
		"attempt_count": metrics.AttemptCount,
		"input_tokens":  metrics.InputTokens,
		"output_tokens": metrics.OutputTokens,
		"duration_ms":   metrics.DurationMS,
		"coverage_rate": metrics.CoverageRate,
		"error_code":    metrics.ErrorCode,
		"updated_at":    time.Now(),
	}
}

func (r *Repository) ListArticles(ctx context.Context, userID uuid.UUID, page, pageSize int) (ArticleListResult, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&Article{}).
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Count(&total).Error; err != nil {
		return ArticleListResult{}, err
	}
	var items []ArticleListItem
	err := r.db.WithContext(ctx).Table("articles AS a").
		Select(`a.id, a.title, a.topic, a.difficulty, a.article_length, a.summary,
			a.target_word_count, a.covered_word_count, a.coverage_rate,
			a.generation_status, a.model_name, a.created_at,
			uap.status AS progress_status,
			COALESCE(uap.progress_percent, 0) AS progress_percent,
			uap.last_paragraph_index`).
		Joins("LEFT JOIN user_article_progress AS uap ON uap.article_id = a.id AND uap.user_id = ?", userID).
		Where("a.user_id = ? AND a.deleted_at IS NULL", userID).
		Order("a.created_at DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&items).Error
	if err != nil {
		return ArticleListResult{}, err
	}
	return ArticleListResult{Items: items, Total: total}, nil
}

func (r *Repository) GetArticle(ctx context.Context, userID, articleID uuid.UUID) (ArticleDetail, error) {
	var row Article
	err := r.db.WithContext(ctx).Where("user_id = ? AND id = ? AND deleted_at IS NULL", userID, articleID).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ArticleDetail{}, ErrArticleNotFound
	}
	if err != nil {
		return ArticleDetail{}, err
	}
	var words []ArticleWord
	if err := r.db.WithContext(ctx).Table("article_words AS aw").
		Select(`aw.id, aw.article_id, aw.word_id, aw.spelling, COALESCE(dict.translation, '') AS translation,
			aw.form, aw.occurrence, aw.context_before, aw.context_after, aw.char_offset, aw.char_length,
			aw.is_covered, aw.created_at`).
		Joins(dictionaryTranslationJoin("aw.spelling")).
		Where("aw.article_id = ?", row.ID).
		Order("aw.spelling ASC").
		Find(&words).Error; err != nil {
		return ArticleDetail{}, err
	}
	return ArticleDetail{Article: row, Words: words}, nil
}

func (r *Repository) DeleteArticle(ctx context.Context, userID, articleID uuid.UUID) error {
	now := time.Now()
	res := r.db.WithContext(ctx).Model(&Article{}).
		Where("user_id = ? AND id = ? AND deleted_at IS NULL", userID, articleID).
		Update("deleted_at", &now)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrArticleNotFound
	}
	return nil
}

func (r *Repository) GetArticleProgress(ctx context.Context, userID, articleID uuid.UUID) (UserArticleProgress, bool, error) {
	var row UserArticleProgress
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND article_id = ?", userID, articleID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return UserArticleProgress{}, false, nil
	}
	if err != nil {
		return UserArticleProgress{}, false, err
	}
	return row, true, nil
}

func (r *Repository) UpsertArticleProgressWithExposures(ctx context.Context, progress UserArticleProgress, recordExposures bool) (UserArticleProgress, error) {
	db := r.db.WithContext(ctx)
	if recordExposures {
		err := db.Transaction(func(tx *gorm.DB) error {
			var err error
			progress, err = upsertArticleProgress(tx, progress)
			if err != nil {
				return err
			}
			return insertArticleExposureEvents(tx, progress.UserID, progress.ArticleID)
		})
		return progress, err
	}
	return upsertArticleProgress(db, progress)
}

func upsertArticleProgress(db *gorm.DB, progress UserArticleProgress) (UserArticleProgress, error) {
	err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "article_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status",
			"progress_percent",
			"last_paragraph_index",
			"started_at",
			"completed_at",
			"updated_at",
		}),
	}).Create(&progress).Error
	if err != nil {
		return UserArticleProgress{}, err
	}
	if err := db.
		Where("user_id = ? AND article_id = ?", progress.UserID, progress.ArticleID).
		First(&progress).Error; err != nil {
		return UserArticleProgress{}, err
	}
	return progress, nil
}

func insertArticleExposureEvents(db *gorm.DB, userID, articleID uuid.UUID) error {
	return db.Exec(`
		INSERT INTO word_learning_events (user_id, word_id, article_id, event_type, source, metadata, created_at)
		SELECT ?, aw.word_id, aw.article_id, ?, 'reader', '{}'::jsonb, NOW()
		FROM article_words AS aw
		WHERE aw.article_id = ?
			AND aw.is_covered = true
			AND NOT EXISTS (
				SELECT 1
				FROM word_learning_events AS existing
				WHERE existing.user_id = ?
					AND existing.word_id = aw.word_id
					AND existing.article_id = aw.article_id
					AND existing.event_type = ?
			)
	`, userID, eventExposedInArticle, articleID, userID, eventExposedInArticle).Error
}

func (r *Repository) findTargetWords(ctx context.Context, userID uuid.UUID, where string, args []any, excludeIgnored bool) ([]TargetWordRecord, error) {
	var rows []struct {
		RecordID         uuid.UUID      `gorm:"column:record_id"`
		WordID           uuid.UUID      `gorm:"column:word_id"`
		Spelling         string         `gorm:"column:spelling"`
		LastResponse     string         `gorm:"column:last_response"`
		StudyCount       int            `gorm:"column:study_count"`
		Tags             datatypes.JSON `gorm:"column:tags"`
		WeakScore        int            `gorm:"column:weak_score"`
		MasteryScore     int            `gorm:"column:mastery_score"`
		LastStudyDate    *time.Time     `gorm:"column:last_study_date"`
		NextStudyDate    *time.Time     `gorm:"column:next_study_date"`
		Pinned           bool           `gorm:"column:pinned"`
		LastRecognizedAt *time.Time     `gorm:"column:last_recognized_at"`
		LastFailedAt     *time.Time     `gorm:"column:last_failed_at"`
		LastExposedAt    *time.Time     `gorm:"column:last_exposed_at"`
	}
	query := r.db.WithContext(ctx).Table("study_records AS sr").
		Select(`sr.id AS record_id, sr.word_id, vw.spelling, sr.last_response, sr.study_count,
			sr.tags, sr.weak_score, sr.mastery_score, sr.last_study_date, sr.next_study_date,
			COALESCE(uwp.pinned, false) AS pinned,
			signals.last_recognized_at, signals.last_failed_at, signals.last_exposed_at`).
		Joins("JOIN vocab_words AS vw ON vw.id = sr.word_id").
		Joins("LEFT JOIN user_word_preferences AS uwp ON uwp.user_id = sr.user_id AND uwp.word_id = sr.word_id").
		Joins(`LEFT JOIN LATERAL (
			SELECT
				MAX(created_at) FILTER (WHERE event_type = 'recognized_in_context') AS last_recognized_at,
				MAX(created_at) FILTER (WHERE event_type = 'failed_in_context') AS last_failed_at,
				MAX(created_at) FILTER (WHERE event_type = 'exposed_in_article') AS last_exposed_at
			FROM word_learning_events
			WHERE user_id = sr.user_id AND word_id = sr.word_id
		) AS signals ON true`).
		Where("sr.user_id = ?", userID).
		Where(where, args...)
	if excludeIgnored {
		query = query.Where("NOT (COALESCE(uwp.ignored, false) = true AND (uwp.ignored_until IS NULL OR uwp.ignored_until > NOW()))")
		query = query.Where(`NOT EXISTS (
			SELECT 1 FROM word_learning_events AS wle
			WHERE wle.user_id = sr.user_id
				AND wle.word_id = sr.word_id
				AND wle.event_type = ?
		)`, "manually_mastered")
	}
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]TargetWordRecord, 0, len(rows))
	for _, row := range rows {
		tags, err := decodeTags(row.Tags)
		if err != nil {
			return nil, err
		}
		out = append(out, TargetWordRecord{
			RecordID:         row.RecordID,
			WordID:           row.WordID,
			Spelling:         row.Spelling,
			LastResponse:     row.LastResponse,
			StudyCount:       row.StudyCount,
			Tags:             tags,
			WeakScore:        row.WeakScore,
			MasteryScore:     row.MasteryScore,
			LastStudyDate:    row.LastStudyDate,
			NextStudyDate:    row.NextStudyDate,
			Pinned:           row.Pinned,
			LastRecognizedAt: row.LastRecognizedAt,
			LastFailedAt:     row.LastFailedAt,
			LastExposedAt:    row.LastExposedAt,
		})
	}
	now := time.Now()
	for i := range out {
		recommendation := vocabulary.CalculateRecommendation(vocabulary.RecommendationInput{
			WeakScore:        out[i].WeakScore,
			Pinned:           out[i].Pinned,
			LastRecognizedAt: out[i].LastRecognizedAt,
			LastFailedAt:     out[i].LastFailedAt,
			LastExposedAt:    out[i].LastExposedAt,
		}, now)
		out[i].RecommendationScore = recommendation.Score
		out[i].RecommendationVersion = recommendation.Version
		out[i].RecommendationReasons = recommendation.Reasons
	}
	return out, nil
}

func sortTargetWords(rows []TargetWordRecord) {
	sort.SliceStable(rows, func(i, j int) bool {
		left, right := rows[i], rows[j]
		if left.RecommendationScore != right.RecommendationScore {
			return left.RecommendationScore > right.RecommendationScore
		}
		if left.WeakScore != right.WeakScore {
			return left.WeakScore > right.WeakScore
		}
		if left.StudyCount != right.StudyCount {
			return left.StudyCount > right.StudyCount
		}
		if left.LastStudyDate == nil || right.LastStudyDate == nil {
			return left.LastStudyDate != nil
		}
		if !left.LastStudyDate.Equal(*right.LastStudyDate) {
			return left.LastStudyDate.After(*right.LastStudyDate)
		}
		return left.Spelling < right.Spelling
	})
}

func isPriorityTarget(row TargetWordRecord) bool {
	return row.WeakScore >= autoPickMinWeakScore ||
		row.MasteryScore < autoPickMaxMastery ||
		row.Pinned ||
		vocabulary.LatestFeedbackIsFailure(row.LastRecognizedAt, row.LastFailedAt)
}

func decodeTags(raw datatypes.JSON) ([]string, error) {
	if len(raw) == 0 {
		return []string{}, nil
	}
	var tags []string
	if err := json.Unmarshal(raw, &tags); err != nil {
		return nil, err
	}
	return tags, nil
}

func quota(targetCount, percent int) int {
	return targetCount * percent / 100
}

func dictionaryTranslationJoin(spellingColumn string) string {
	return fmt.Sprintf(`LEFT JOIN LATERAL (
		SELECT string_agg(
			trim(concat_ws(' ', NULLIF(t.item->>'pos', ''), NULLIF(t.item->>'tranCn', ''))),
			'; '
		) AS translation
		FROM dictionary_entries AS de
		CROSS JOIN LATERAL jsonb_array_elements(de.translations) AS t(item)
		WHERE de.source = 'kajweb_dict'
			AND de.normalized_headword = lower(trim(%s))
			AND NULLIF(t.item->>'tranCn', '') IS NOT NULL
		GROUP BY de.id, de.source_book_id
		ORDER BY de.source_book_id ASC
		LIMIT 1
	) AS dict ON true`, spellingColumn)
}
