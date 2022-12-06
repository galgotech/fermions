package commentmodel

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/user"
)

type PermissionChecker struct {
	sqlStore         db.DB
	features         featuremgmt.FeatureToggles
	accessControl    accesscontrol.AccessControl
	dashboardService dashboards.DashboardService
}

func NewPermissionChecker(sqlStore db.DB, features featuremgmt.FeatureToggles,
	accessControl accesscontrol.AccessControl, dashboardService dashboards.DashboardService,
) *PermissionChecker {
	return &PermissionChecker{sqlStore: sqlStore, features: features, accessControl: accessControl}
}

func (c *PermissionChecker) getDashboardByUid(ctx context.Context, orgID int64, uid string) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Uid: uid, OrgId: orgID}
	if err := c.dashboardService.GetDashboard(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (c *PermissionChecker) getDashboardById(ctx context.Context, orgID int64, id int64) (*models.Dashboard, error) {
	query := models.GetDashboardQuery{Id: id, OrgId: orgID}
	if err := c.dashboardService.GetDashboard(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (c *PermissionChecker) CheckReadPermissions(ctx context.Context, orgId int64, signedInUser *user.SignedInUser, objectType string, objectID string) (bool, error) {
	switch objectType {
	case ObjectTypeOrg:
		return false, nil
	case ObjectTypeDashboard:
		if !c.features.IsEnabled(featuremgmt.FlagDashboardComments) {
			return false, nil
		}
		dash, err := c.getDashboardByUid(ctx, orgId, objectID)
		if err != nil {
			return false, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanView(); err != nil || !ok {
			return false, nil
		}
	default:
		return false, nil
	}
	return true, nil
}

func (c *PermissionChecker) CheckWritePermissions(ctx context.Context, orgId int64, signedInUser *user.SignedInUser, objectType string, objectID string) (bool, error) {
	switch objectType {
	case ObjectTypeOrg:
		return false, nil
	case ObjectTypeDashboard:
		if !c.features.IsEnabled(featuremgmt.FlagDashboardComments) {
			return false, nil
		}
		dash, err := c.getDashboardByUid(ctx, orgId, objectID)
		if err != nil {
			return false, err
		}
		guard := guardian.New(ctx, dash.Id, orgId, signedInUser)
		if ok, err := guard.CanEdit(); err != nil || !ok {
			return false, nil
		}
	default:
		return false, nil
	}
	return true, nil
}
