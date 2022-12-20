package migrations

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("secret.migration")

const actionName = "secret migration task "

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	Migrate(ctx context.Context) error
}
