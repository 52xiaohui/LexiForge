package dictionary

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/datatypes"
)

const SourceKajwebDict = "kajweb_dict"

type Importer struct {
	repo   *Repository
	source string
}

func NewImporter(repo *Repository, source string) *Importer {
	source = cleanString(source)
	if source == "" {
		source = SourceKajwebDict
	}
	return &Importer{repo: repo, source: source}
}

type ImportResult struct {
	FilesProcessed  int `json:"files_processed"`
	EntriesUpserted int `json:"entries_upserted"`
	EntriesSkipped  int `json:"entries_skipped"`
}

func (i *Importer) ImportPath(ctx context.Context, path string) (ImportResult, error) {
	info, err := os.Stat(path)
	if err != nil {
		return ImportResult{}, fmt.Errorf("stat source path: %w", err)
	}
	if !info.IsDir() {
		return i.importFile(ctx, path)
	}

	var result ImportResult
	err = filepath.WalkDir(path, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.EqualFold(filepath.Ext(p), ".json") {
			return nil
		}
		fileResult, err := i.importFile(ctx, p)
		if err != nil {
			return err
		}
		result.FilesProcessed += fileResult.FilesProcessed
		result.EntriesUpserted += fileResult.EntriesUpserted
		result.EntriesSkipped += fileResult.EntriesSkipped
		return nil
	})
	return result, err
}

func (i *Importer) importFile(ctx context.Context, path string) (ImportResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return ImportResult{}, fmt.Errorf("read %s: %w", path, err)
	}
	rawEntries, err := decodeRawEntries(data)
	if err != nil {
		return ImportResult{}, fmt.Errorf("decode %s: %w", path, err)
	}

	entries := make([]Entry, 0, len(rawEntries))
	skipped := 0
	for _, raw := range rawEntries {
		entry, ok, err := i.mapRawEntry(raw)
		if err != nil {
			return ImportResult{}, err
		}
		if !ok {
			skipped++
			continue
		}
		entries = append(entries, entry)
	}
	if err := i.repo.UpsertBatch(ctx, entries); err != nil {
		return ImportResult{}, fmt.Errorf("upsert %s: %w", path, err)
	}
	return ImportResult{FilesProcessed: 1, EntriesUpserted: len(entries), EntriesSkipped: skipped}, nil
}

func decodeRawEntries(data []byte) ([]rawKajwebEntry, error) {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return nil, nil
	}
	if data[0] == '[' {
		var entries []rawKajwebEntry
		if err := json.Unmarshal(data, &entries); err != nil {
			return nil, err
		}
		return entries, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	entries := make([]rawKajwebEntry, 0)
	for {
		var entry rawKajwebEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func (i *Importer) mapRawEntry(raw rawKajwebEntry) (Entry, bool, error) {
	word := raw.Content.Word
	body := word.Content
	headword := cleanString(raw.HeadWord)
	if headword == "" {
		headword = cleanString(word.WordHead)
	}
	normalized := NormalizeHeadword(headword)
	if normalized == "" {
		return Entry{}, false, nil
	}
	sourceWordID := cleanString(word.WordID)
	if sourceWordID == "" {
		sourceWordID = fmt.Sprintf("%s_%d_%s", cleanString(raw.BookID), raw.WordRank, normalized)
	}
	rawPayload, err := json.Marshal(raw)
	if err != nil {
		return Entry{}, false, fmt.Errorf("marshal raw payload: %w", err)
	}
	return Entry{
		Source:             i.source,
		SourceWordID:       sourceWordID,
		SourceBookID:       cleanString(raw.BookID),
		Headword:           headword,
		NormalizedHeadword: normalized,
		UKPhone:            cleanString(body.UKPhone),
		USPhone:            cleanString(body.USPhone),
		Translations:       mustJSON(body.Trans),
		Examples:           mustJSON(body.Sentence.Sentences),
		Phrases:            mustJSON(body.Phrase.Phrases),
		Synonyms:           mustJSON(body.Syno.Synos),
		RelatedWords:       mustJSON(body.RelWord.Rels),
		Exams:              mustJSON(body.Exam),
		RawPayload:         datatypes.JSON(rawPayload),
	}, true, nil
}

func mustJSON(v any) datatypes.JSON {
	data, err := json.Marshal(v)
	if err != nil || string(data) == "null" {
		return datatypes.JSON([]byte("[]"))
	}
	return datatypes.JSON(data)
}

func decodeJSON(raw datatypes.JSON) any {
	if len(raw) == 0 {
		return []any{}
	}
	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		return []any{}
	}
	if out == nil {
		return []any{}
	}
	return out
}

type rawKajwebEntry struct {
	WordRank int    `json:"wordRank"`
	HeadWord string `json:"headWord"`
	BookID   string `json:"bookId"`
	Content  struct {
		Word struct {
			WordHead string `json:"wordHead"`
			WordID   string `json:"wordId"`
			Content  struct {
				Exam     []rawExam `json:"exam"`
				Sentence struct {
					Sentences []rawSentence `json:"sentences"`
				} `json:"sentence"`
				UKPhone string `json:"ukphone"`
				USPhone string `json:"usphone"`
				Phrase  struct {
					Phrases []rawPhrase `json:"phrases"`
				} `json:"phrase"`
				Syno struct {
					Synos []rawSynonym `json:"synos"`
				} `json:"syno"`
				RelWord struct {
					Rels []rawRelatedGroup `json:"rels"`
				} `json:"relWord"`
				Trans []rawTranslation `json:"trans"`
			} `json:"content"`
		} `json:"word"`
	} `json:"content"`
}

type rawSentence struct {
	SContent string `json:"sContent"`
	SCn      string `json:"sCn"`
}

type rawPhrase struct {
	PContent string `json:"pContent"`
	PCn      string `json:"pCn"`
}

type rawTranslation struct {
	TranCn    string `json:"tranCn"`
	TranOther string `json:"tranOther"`
	Pos       string `json:"pos"`
	DescCn    string `json:"descCn"`
	DescOther string `json:"descOther"`
}

type rawSynonym struct {
	Pos  string `json:"pos"`
	Tran string `json:"tran"`
	Hwds []struct {
		W string `json:"w"`
	} `json:"hwds"`
}

type rawRelatedGroup struct {
	Pos   string `json:"pos"`
	Words []struct {
		Hwd  string `json:"hwd"`
		Tran string `json:"tran"`
	} `json:"words"`
}

type rawExam struct {
	Question string `json:"question"`
	Answer   any    `json:"answer"`
	ExamType int    `json:"examType"`
	Choices  []struct {
		ChoiceIndex int    `json:"choiceIndex"`
		Choice      string `json:"choice"`
	} `json:"choices"`
}
