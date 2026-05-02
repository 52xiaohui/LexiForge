package vocabulary

// Service holds the business logic for vocabulary operations.
//
// MVP keeps this empty — repo CRUD is enough until scoring lands.
type Service struct {
	repo *Repository
}

// NewService is the canonical constructor (used by NewModule and tests).
func NewService(repo *Repository) *Service { return &Service{repo: repo} }
