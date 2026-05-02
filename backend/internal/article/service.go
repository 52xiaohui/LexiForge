package article

// Service orchestrates article generation, coverage validation and listing.
//
// MVP leaves this empty; the AI-call + coverage flow from
// docs/05-ai-workflow.md will live here.
type Service struct {
	repo *Repository
}

// NewService is the canonical constructor.
func NewService(repo *Repository) *Service { return &Service{repo: repo} }
