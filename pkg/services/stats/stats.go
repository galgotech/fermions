package stats

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error
	GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error
	GetSystemUserCountStats(ctx context.Context, query *models.GetSystemUserCountStatsQuery) error
}
