package maimemo

// Service runs the sync flow: pull from MaiMemo client, score, upsert via
// repo. MVP keeps the body empty.
type Service struct {
	repo   *Repository
	client Client
}

// NewService is the canonical constructor.
func NewService(repo *Repository, client Client) *Service {
	return &Service{repo: repo, client: client}
}
