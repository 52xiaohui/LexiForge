package dictionary

import (
	"strings"
	"unicode"
)

var accentReplacer = strings.NewReplacer(
	"é", "e",
	"ê", "e",
	"è", "e",
	"ë", "e",
	"à", "a",
	"â", "a",
	"ç", "c",
	"î", "i",
	"ï", "i",
	"ô", "o",
	"ù", "u",
	"û", "u",
	"ü", "u",
	"ÿ", "y",
)

func NormalizeHeadword(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = accentReplacer.Replace(s)
	var b strings.Builder
	lastSpace := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !lastSpace {
				b.WriteByte(' ')
				lastSpace = true
			}
			continue
		}
		b.WriteRune(r)
		lastSpace = false
	}
	return strings.TrimSpace(b.String())
}
