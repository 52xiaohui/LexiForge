package export

// Service will host CSV / Anki / Markdown export logic in v0.5+. MVP keeps
// it empty so the layering is in place from day one.
type Service struct {
	repo *Repository
}

// NewService is the canonical constructor.
func NewService(repo *Repository) *Service { return &Service{repo: repo} }
