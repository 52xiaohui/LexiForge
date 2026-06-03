package dictionary

import (
	"encoding/json"
	"testing"
)

func TestImporterMapRawEntry(t *testing.T) {
	data := []byte(`{
		"wordRank": 1,
		"headWord": "Cancel",
		"bookId": "CET4_3",
		"content": {
			"word": {
				"wordHead": "cancel",
				"wordId": "CET4_3_1",
				"content": {
					"ukphone": "'kænsl",
					"usphone": "'kænsl",
					"sentence": {
						"sentences": [
							{"sContent": "Our flight was cancelled.", "sCn": "我们的航班取消了。"}
						]
					},
					"phrase": {
						"phrases": [
							{"pContent": "cancel button", "pCn": "取消按钮"}
						]
					},
					"syno": {
						"synos": [
							{"pos": "vt", "tran": "取消", "hwds": [{"w": "recall"}]}
						]
					},
					"relWord": {
						"rels": [
							{"pos": "n", "words": [{"hwd": "cancellation", "tran": "取消"}]}
						]
					},
					"trans": [
						{"tranCn": "取消，撤销", "tranOther": "to decide that something will not happen", "pos": "vt"}
					],
					"exam": [
						{"question": "We have to ______ it.", "examType": 1}
					]
				}
			}
		}
	}`)
	var raw rawKajwebEntry
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatal(err)
	}

	importer := NewImporter(nil, "")
	entry, ok, err := importer.mapRawEntry(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("entry unexpectedly skipped")
	}
	if entry.Source != SourceKajwebDict {
		t.Fatalf("Source = %q", entry.Source)
	}
	if entry.SourceWordID != "CET4_3_1" {
		t.Fatalf("SourceWordID = %q", entry.SourceWordID)
	}
	if entry.SourceBookID != "CET4_3" {
		t.Fatalf("SourceBookID = %q", entry.SourceBookID)
	}
	if entry.Headword != "Cancel" || entry.NormalizedHeadword != "cancel" {
		t.Fatalf("headword = %q normalized = %q", entry.Headword, entry.NormalizedHeadword)
	}
	if len(entry.Translations) == 0 || len(entry.Examples) == 0 || len(entry.RawPayload) == 0 {
		t.Fatal("expected extracted JSON fields and raw payload")
	}
}

func TestDecodeRawEntriesArray(t *testing.T) {
	entries, err := decodeRawEntries([]byte(`[
		{"wordRank": 1, "headWord": "cancel", "bookId": "CET4_1"},
		{"wordRank": 2, "headWord": "absorb", "bookId": "CET4_1"}
	]`))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("len(entries) = %d", len(entries))
	}
	if entries[0].HeadWord != "cancel" || entries[1].HeadWord != "absorb" {
		t.Fatalf("unexpected entries: %#v", entries)
	}
}

func TestDecodeRawEntriesJSONStream(t *testing.T) {
	entries, err := decodeRawEntries([]byte(`
		{"wordRank": 1, "headWord": "cancel", "bookId": "CET4_1"}
		{"wordRank": 2, "headWord": "absorb", "bookId": "CET4_1"}
	`))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("len(entries) = %d", len(entries))
	}
	if entries[0].BookID != "CET4_1" || entries[1].WordRank != 2 {
		t.Fatalf("unexpected entries: %#v", entries)
	}
}
