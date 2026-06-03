package dictionary

import "testing"

func TestNormalizeHeadword(t *testing.T) {
	tests := map[string]string{
		"  Café  ":        "cafe",
		"crème brûlée":    "creme brulee",
		"Multiple\tWords": "multiple words",
		"Cancel":          "cancel",
	}
	for in, want := range tests {
		if got := NormalizeHeadword(in); got != want {
			t.Fatalf("NormalizeHeadword(%q) = %q, want %q", in, got, want)
		}
	}
}
