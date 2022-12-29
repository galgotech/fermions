package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type Provider struct{}

func ProvideService(
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService, dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService, teamService team.Service,
) *Provider {
	// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
	InitAccessControlGuardian(store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	return &Provider{}
}

func InitAccessControlGuardian(
	store db.DB, ac accesscontrol.AccessControl, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardService dashboards.DashboardService,
) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) DashboardGuardian {
		return NewAccessControlDashboardGuardian(ctx, dashId, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}
}
