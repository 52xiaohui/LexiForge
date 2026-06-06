package vocabulary

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	weakListMinWeakScore     = 50
	weakListMaxMastery       = 60
	recognizedInContextEvent = "recognized_in_context"
	failedInContextEvent     = "failed_in_context"
	manuallyMasteredEvent    = "manually_mastered"
)

// Repository owns the GORM access for vocab_words and study_records.
//
// MVP keeps this empty; once sync lands the upsert / scoring queries live
// here, never on the handler.
type Repository struct {
	db *gorm.DB
}

// NewRepository wraps a *gorm.DB so the service layer never imports gorm.
func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

type ListOptions struct {
	UserID       uuid.UUID
	Page         int
	PageSize     int
	Search       string
	LastResponse string
	Tag          string
	MinWeakScore *int
	MasteryTier  string
	WeakOnly     bool
	Sort         string
}

type RecordRow struct {
	ID             uuid.UUID      `json:"id"`
	UserID         uuid.UUID      `json:"user_id"`
	WordID         uuid.UUID      `json:"word_id"`
	Provider       string         `json:"provider"`
	ProviderVocID  string         `json:"provider_voc_id"`
	Spelling       string         `json:"spelling"`
	Translation    string         `json:"translation"`
	LastResponse   string         `json:"last_response"`
	StudyCount     int            `json:"study_count"`
	Tags           datatypes.JSON `json:"tags"`
	AddDate        *time.Time     `json:"add_date,omitempty"`
	FirstStudyDate *time.Time     `json:"first_study_date,omitempty"`
	LastStudyDate  *time.Time     `json:"last_study_date,omitempty"`
	NextStudyDate  *time.Time     `json:"next_study_date,omitempty"`
	MasteryScore   int            `json:"mastery_score"`
	WeakScore      int            `json:"weak_score"`
	ScoreVersion   string         `json:"score_version"`
	ScoreReasons   datatypes.JSON `json:"score_reasons"`
	Ignored        bool           `json:"ignored"`
	IgnoredReason  *string        `json:"ignored_reason,omitempty"`
	IgnoredUntil   *time.Time     `json:"ignored_until,omitempty"`
	Pinned         bool           `json:"pinned"`
	Recognized     bool           `json:"recognized"`
	Mastered       bool           `json:"mastered"`
	LastScoredAt   *time.Time     `json:"last_scored_at,omitempty"`
	SyncedAt       *time.Time     `json:"synced_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

type ListResult struct {
	Items []RecordRow
	Total int64
}

type Summary struct {
	Total             int64            `json:"total"`
	WeakCount         int64            `json:"weak_count"`
	StickingCount     int64            `json:"sticking_count"`
	ByLastResponse    map[string]int64 `json:"by_last_response"`
	ByMasteryTier     map[string]int64 `json:"by_mastery_tier"`
	LatestSyncedAt    *time.Time       `json:"latest_synced_at,omitempty"`
	NextStudyDueCount int64            `json:"next_study_due_count"`
}

func (r *Repository) ListRecords(opts ListOptions) (ListResult, error) {
	var rows []RecordRow
	query := r.recordsBaseQuery(opts)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return ListResult{}, err
	}

	err := query.
		Select(recordSelectColumns()).
		Order(orderClause(opts.Sort, opts.WeakOnly)).
		Limit(opts.PageSize).
		Offset((opts.Page - 1) * opts.PageSize).
		Find(&rows).Error
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: rows, Total: total}, nil
}

func (r *Repository) GetRecord(userID, id uuid.UUID) (RecordRow, error) {
	var row RecordRow
	err := r.db.Table("study_records AS sr").
		Select(recordSelectColumns()).
		Joins("JOIN vocab_words AS vw ON vw.id = sr.word_id").
		Joins("LEFT JOIN user_word_preferences AS uwp ON uwp.user_id = sr.user_id AND uwp.word_id = sr.word_id").
		Joins(dictionaryTranslationJoin("vw.spelling")).
		Where("sr.user_id = ? AND sr.id = ?", userID, id).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return RecordRow{}, ErrRecordNotFound
	}
	if err != nil {
		return RecordRow{}, err
	}
	return row, nil
}

func (r *Repository) UpsertPreference(userID, wordID uuid.UUID, input PreferenceInput) (UserWordPreference, error) {
	row := UserWordPreference{
		UserID:        userID,
		WordID:        wordID,
		Ignored:       input.Ignored,
		IgnoredReason: input.IgnoredReason,
		IgnoredUntil:  input.IgnoredUntil,
		Pinned:        input.Pinned,
	}
	err := r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "word_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"ignored",
			"ignored_reason",
			"ignored_until",
			"pinned",
			"updated_at",
		}),
	}).Create(&row).Error
	if err != nil {
		return UserWordPreference{}, err
	}
	if err := r.db.Where("user_id = ? AND word_id = ?", userID, wordID).First(&row).Error; err != nil {
		return UserWordPreference{}, err
	}
	return row, nil
}

func (r *Repository) Summary(userID uuid.UUID) (Summary, error) {
	summary := Summary{
		ByLastResponse: map[string]int64{},
		ByMasteryTier:  map[string]int64{"mastered": 0, "learning": 0, "starting": 0},
	}

	if err := r.db.Model(&StudyRecord{}).Where("user_id = ?", userID).Count(&summary.Total).Error; err != nil {
		return Summary{}, err
	}
	activePreferenceSQL := `NOT EXISTS (
		SELECT 1 FROM user_word_preferences AS uwp
		WHERE uwp.user_id = study_records.user_id
			AND uwp.word_id = study_records.word_id
			AND uwp.ignored = true
	)`
	notManuallyMasteredSQL := `NOT EXISTS (
		SELECT 1 FROM word_learning_events AS wle
		WHERE wle.user_id = study_records.user_id
			AND wle.word_id = study_records.word_id
			AND wle.event_type = '` + manuallyMasteredEvent + `'
	)`
	if err := r.db.Model(&StudyRecord{}).
		Where("user_id = ? AND (weak_score >= ? OR mastery_score < ?)", userID, weakListMinWeakScore, weakListMaxMastery).
		Where(activePreferenceSQL).
		Where(notManuallyMasteredSQL).
		Count(&summary.WeakCount).Error; err != nil {
		return Summary{}, err
	}
	if err := r.db.Model(&StudyRecord{}).Where("user_id = ? AND tags @> ?::jsonb", userID, `["STICKING"]`).Where(activePreferenceSQL).Where(notManuallyMasteredSQL).Count(&summary.StickingCount).Error; err != nil {
		return Summary{}, err
	}
	if err := r.db.Model(&StudyRecord{}).Where("user_id = ? AND next_study_date <= ?", userID, time.Now()).Count(&summary.NextStudyDueCount).Error; err != nil {
		return Summary{}, err
	}

	type responseCount struct {
		LastResponse string
		Count        int64
	}
	var counts []responseCount
	if err := r.db.Model(&StudyRecord{}).
		Select("last_response, count(*) AS count").
		Where("user_id = ?", userID).
		Group("last_response").
		Find(&counts).Error; err != nil {
		return Summary{}, err
	}
	for _, count := range counts {
		summary.ByLastResponse[count.LastResponse] = count.Count
	}

	type masteryCount struct {
		Tier  string
		Count int64
	}
	var masteryCounts []masteryCount
	masteryTierSQL := `CASE
		WHEN mastery_score >= 80 THEN 'mastered'
		WHEN mastery_score >= 45 THEN 'learning'
		ELSE 'starting'
	END`
	if err := r.db.Model(&StudyRecord{}).
		Select(masteryTierSQL+" AS tier, count(*) AS count").
		Where("user_id = ?", userID).
		Group(masteryTierSQL).
		Find(&masteryCounts).Error; err != nil {
		return Summary{}, err
	}
	for _, count := range masteryCounts {
		summary.ByMasteryTier[count.Tier] = count.Count
	}

	var latest StudyRecord
	err := r.db.Where("user_id = ? AND synced_at IS NOT NULL", userID).Order("synced_at DESC").First(&latest).Error
	if err == nil {
		summary.LatestSyncedAt = latest.SyncedAt
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return Summary{}, err
	}
	return summary, nil
}

func (r *Repository) recordsBaseQuery(opts ListOptions) *gorm.DB {
	query := r.db.Table("study_records AS sr").
		Joins("JOIN vocab_words AS vw ON vw.id = sr.word_id").
		Joins("LEFT JOIN user_word_preferences AS uwp ON uwp.user_id = sr.user_id AND uwp.word_id = sr.word_id").
		Joins(dictionaryTranslationJoin("vw.spelling")).
		Where("sr.user_id = ?", opts.UserID)
	if opts.Search != "" {
		pattern := "%" + opts.Search + "%"
		query = query.Where(
			"(vw.spelling ILIKE ? OR COALESCE(dict.translation, '') ILIKE ?)",
			pattern,
			pattern,
		)
	}
	if opts.LastResponse != "" {
		query = query.Where("sr.last_response = ?", opts.LastResponse)
	}
	if opts.Tag != "" {
		tagJSON, err := json.Marshal([]string{opts.Tag})
		if err != nil {
			return query.Where("1 = 0")
		}
		query = query.Where("sr.tags @> ?::jsonb", string(tagJSON))
	}
	if opts.MinWeakScore != nil {
		query = query.Where("sr.weak_score >= ?", *opts.MinWeakScore)
	}
	switch opts.MasteryTier {
	case "mastered":
		query = query.Where("sr.mastery_score >= 80")
	case "learning":
		query = query.Where("sr.mastery_score >= 45 AND sr.mastery_score < 80")
	case "starting":
		query = query.Where("sr.mastery_score < 45")
	}
	if opts.WeakOnly && opts.MinWeakScore == nil {
		query = query.Where("(sr.weak_score >= ? OR sr.mastery_score < ?)", weakListMinWeakScore, weakListMaxMastery)
	}
	if opts.WeakOnly {
		query = query.Where("COALESCE(uwp.ignored, false) = false")
		query = query.Where(`NOT EXISTS (
			SELECT 1 FROM word_learning_events AS wle
			WHERE wle.user_id = sr.user_id
				AND wle.word_id = sr.word_id
				AND wle.event_type = ?
		)`, manuallyMasteredEvent)
	}
	return query
}

func recordSelectColumns() string {
	return `sr.id, sr.user_id, sr.word_id, sr.provider, sr.provider_voc_id,
		vw.spelling, COALESCE(dict.translation, '') AS translation,
		sr.last_response, sr.study_count, sr.tags, sr.add_date,
		sr.first_study_date, sr.last_study_date, sr.next_study_date,
		sr.mastery_score, sr.weak_score, sr.score_version, sr.score_reasons,
		COALESCE(uwp.ignored, false) AS ignored, uwp.ignored_reason, uwp.ignored_until,
		COALESCE(uwp.pinned, false) AS pinned,
		COALESCE((
			SELECT wle.event_type
			FROM word_learning_events AS wle
			WHERE wle.user_id = sr.user_id
				AND wle.word_id = sr.word_id
				AND wle.event_type IN ('` + recognizedInContextEvent + `', '` + failedInContextEvent + `')
			ORDER BY wle.created_at DESC
			LIMIT 1
		) = '` + recognizedInContextEvent + `', false) AS recognized,
		EXISTS (
			SELECT 1 FROM word_learning_events AS wle
			WHERE wle.user_id = sr.user_id
				AND wle.word_id = sr.word_id
				AND wle.event_type = '` + manuallyMasteredEvent + `'
		) AS mastered,
		sr.last_scored_at, sr.synced_at, sr.created_at, sr.updated_at`
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

func orderClause(sort string, weakOnly bool) string {
	switch sort {
	case "spelling":
		return "vw.spelling ASC"
	case "-spelling":
		return "vw.spelling DESC"
	case "mastery_score":
		return "sr.mastery_score ASC"
	case "-mastery_score":
		return "sr.mastery_score DESC"
	case "study_count":
		return "sr.study_count ASC"
	case "-study_count":
		return "sr.study_count DESC"
	case "last_study_date":
		return "sr.last_study_date ASC NULLS LAST"
	case "-last_study_date":
		return "sr.last_study_date DESC NULLS LAST"
	case "next_study_date":
		return "sr.next_study_date ASC NULLS LAST"
	case "-next_study_date":
		return "sr.next_study_date DESC NULLS LAST"
	case "weak_score":
		return "sr.weak_score ASC"
	case "-weak_score":
		return "sr.weak_score DESC"
	default:
		if weakOnly {
			return "sr.weak_score DESC, sr.study_count DESC, vw.spelling ASC"
		}
		return "vw.spelling ASC"
	}
}
