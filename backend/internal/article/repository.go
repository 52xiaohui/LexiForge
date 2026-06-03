package article

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Repository owns the GORM access for articles + article_words.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

type TargetWordRecord struct {
	RecordID      uuid.UUID
	WordID        uuid.UUID
	Spelling      string
	LastResponse  string
	StudyCount    int
	Tags          []string
	WeakScore     int
	MasteryScore  int
	LastStudyDate *time.Time
	NextStudyDate *time.Time
}

type ArticleDraft struct {
	UserID           uuid.UUID
	Title            string
	Topic            string
	Difficulty       string
	ContentMarkdown  string
	Summary          string
	TargetWordCount  int
	CoveredWordCount int
	CoverageRate     decimal.Decimal
	GenerationStatus string
	ModelName        string
	PromptVersion    string
	Words            []ArticleWordDraft
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
	ID               uuid.UUID `json:"id"`
	Title            string    `json:"title"`
	Topic            string    `json:"topic"`
	Difficulty       string    `json:"difficulty"`
	Summary          string    `json:"summary"`
	TargetWordCount  int       `json:"target_word_count"`
	CoveredWordCount int       `json:"covered_word_count"`
	CoverageRate     float64   `json:"coverage_rate"`
	GenerationStatus string    `json:"generation_status"`
	ModelName        string    `json:"model_name"`
	CreatedAt        time.Time `json:"created_at"`
}

type ArticleListResult struct {
	Items []ArticleListItem
	Total int64
}

var ErrArticleNotFound = errors.New("article not found")

const (
	autoPickMinWeakScore = 50
	autoPickMaxMastery   = 60
)

func (r *Repository) SelectTargetWords(ctx context.Context, userID uuid.UUID, selectedIDs []uuid.UUID, targetCount int) ([]TargetWordRecord, error) {
	selected := make([]TargetWordRecord, 0, len(selectedIDs))
	seenWords := map[uuid.UUID]struct{}{}

	if len(selectedIDs) > 0 {
		rows, err := r.findTargetWords(ctx, userID, "sr.id IN ?", []any{selectedIDs}, len(selectedIDs))
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

	targets := selected
	remaining := targetCount - len(targets)
	if remaining <= 0 {
		return targets, nil
	}

	plans := []struct {
		where string
		args  []any
		limit int
	}{
		{where: "(sr.weak_score >= ? OR sr.mastery_score < ?)", args: []any{autoPickMinWeakScore, autoPickMaxMastery}, limit: quota(targetCount, 70) - len(targets)},
		{where: "sr.mastery_score BETWEEN ? AND ?", args: []any{45, 80}, limit: quota(targetCount, 20)},
		{where: "sr.last_study_date IS NOT NULL", limit: targetCount},
		{where: "1 = 1", limit: targetCount},
	}
	for _, plan := range plans {
		if len(targets) >= targetCount {
			break
		}
		limit := plan.limit
		if limit <= 0 {
			limit = targetCount - len(targets)
		}
		rows, err := r.findTargetWords(ctx, userID, plan.where, plan.args, limit+len(seenWords))
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			if len(targets) >= targetCount {
				break
			}
			if _, exists := seenWords[row.WordID]; exists {
				continue
			}
			targets = append(targets, row)
			seenWords[row.WordID] = struct{}{}
		}
	}
	return targets, nil
}

func (r *Repository) SaveGeneratedArticle(ctx context.Context, draft ArticleDraft) (ArticleDetail, error) {
	var detail ArticleDetail
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row := Article{
			UserID:           draft.UserID,
			Title:            draft.Title,
			Topic:            draft.Topic,
			Difficulty:       draft.Difficulty,
			ContentMarkdown:  draft.ContentMarkdown,
			Summary:          draft.Summary,
			TargetWordCount:  draft.TargetWordCount,
			CoveredWordCount: draft.CoveredWordCount,
			CoverageRate:     draft.CoverageRate,
			GenerationStatus: draft.GenerationStatus,
			ModelName:        draft.ModelName,
			PromptVersion:    draft.PromptVersion,
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
		detail = ArticleDetail{Article: row, Words: words}
		return nil
	})
	return detail, err
}

func (r *Repository) ListArticles(ctx context.Context, userID uuid.UUID, page, pageSize int) (ArticleListResult, error) {
	query := r.db.WithContext(ctx).Model(&Article{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return ArticleListResult{}, err
	}
	var items []ArticleListItem
	err := query.Select("id, title, topic, difficulty, summary, target_word_count, covered_word_count, coverage_rate, generation_status, model_name, created_at").
		Order("created_at DESC").
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

func (r *Repository) findTargetWords(ctx context.Context, userID uuid.UUID, where string, args []any, limit int) ([]TargetWordRecord, error) {
	var rows []struct {
		RecordID      uuid.UUID      `gorm:"column:record_id"`
		WordID        uuid.UUID      `gorm:"column:word_id"`
		Spelling      string         `gorm:"column:spelling"`
		LastResponse  string         `gorm:"column:last_response"`
		StudyCount    int            `gorm:"column:study_count"`
		Tags          datatypes.JSON `gorm:"column:tags"`
		WeakScore     int            `gorm:"column:weak_score"`
		MasteryScore  int            `gorm:"column:mastery_score"`
		LastStudyDate *time.Time     `gorm:"column:last_study_date"`
		NextStudyDate *time.Time     `gorm:"column:next_study_date"`
	}
	query := r.db.WithContext(ctx).Table("study_records AS sr").
		Select(`sr.id AS record_id, sr.word_id, vw.spelling, sr.last_response, sr.study_count,
			sr.tags, sr.weak_score, sr.mastery_score, sr.last_study_date, sr.next_study_date`).
		Joins("JOIN vocab_words AS vw ON vw.id = sr.word_id").
		Where("sr.user_id = ?", userID).
		Where(where, args...).
		Order("sr.weak_score DESC, sr.study_count DESC, sr.last_study_date DESC NULLS LAST, vw.spelling ASC").
		Limit(limit)
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
			RecordID:      row.RecordID,
			WordID:        row.WordID,
			Spelling:      row.Spelling,
			LastResponse:  row.LastResponse,
			StudyCount:    row.StudyCount,
			Tags:          tags,
			WeakScore:     row.WeakScore,
			MasteryScore:  row.MasteryScore,
			LastStudyDate: row.LastStudyDate,
			NextStudyDate: row.NextStudyDate,
		})
	}
	return out, nil
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
