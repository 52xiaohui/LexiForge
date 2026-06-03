package dictionary

import (
	"context"
	"fmt"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

type EntryResponse struct {
	ID                 string `json:"id"`
	Source             string `json:"source"`
	SourceWordID       string `json:"source_word_id"`
	SourceBookID       string `json:"source_book_id"`
	Headword           string `json:"headword"`
	NormalizedHeadword string `json:"normalized_headword"`
	UKPhone            string `json:"uk_phone"`
	USPhone            string `json:"us_phone"`
	Translations       any    `json:"translations"`
	Examples           any    `json:"examples"`
	Phrases            any    `json:"phrases"`
	Synonyms           any    `json:"synonyms"`
	RelatedWords       any    `json:"related_words"`
	Exams              any    `json:"exams"`
}

func (s *Service) Lookup(ctx context.Context, word string) (EntryResponse, error) {
	normalized := NormalizeHeadword(word)
	if normalized == "" {
		return EntryResponse{}, fmt.Errorf("word is required")
	}
	row, err := s.repo.Lookup(ctx, normalized)
	if err != nil {
		return EntryResponse{}, err
	}
	return mapEntry(row), nil
}

func mapEntry(row Entry) EntryResponse {
	return EntryResponse{
		ID:                 row.ID.String(),
		Source:             row.Source,
		SourceWordID:       row.SourceWordID,
		SourceBookID:       row.SourceBookID,
		Headword:           row.Headword,
		NormalizedHeadword: row.NormalizedHeadword,
		UKPhone:            row.UKPhone,
		USPhone:            row.USPhone,
		Translations:       decodeJSON(row.Translations),
		Examples:           decodeJSON(row.Examples),
		Phrases:            decodeJSON(row.Phrases),
		Synonyms:           decodeJSON(row.Synonyms),
		RelatedWords:       decodeJSON(row.RelatedWords),
		Exams:              decodeJSON(row.Exams),
	}
}

func cleanString(s string) string {
	return strings.TrimSpace(s)
}
