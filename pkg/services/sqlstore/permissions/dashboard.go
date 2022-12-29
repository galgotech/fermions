package permissions

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
)

type AccessControlDashboardPermissionFilter struct {
	user             *user.SignedInUser
	folderActions    []string
	dashboardActions []string
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the models.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel models.PermissionType, queryType string) AccessControlDashboardPermissionFilter {
	needEdit := permissionLevel > models.PERMISSION_VIEW
	folderActions := []string{dashboards.ActionFoldersRead}
	var dashboardActions []string

	dashboardActions = append(dashboardActions, dashboards.ActionDashboardsRead)
	if needEdit {
		folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
		dashboardActions = append(dashboardActions, dashboards.ActionDashboardsWrite)
	}

	return AccessControlDashboardPermissionFilter{user: user, folderActions: folderActions, dashboardActions: dashboardActions}
}

func (f AccessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	if f.user == nil || f.user.Permissions == nil || f.user.Permissions[f.user.OrgID] == nil {
		return "(1 = 0)", nil
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	filter, params := accesscontrol.UserRolesFilter(f.user.OrgID, f.user.UserID, f.user.Teams, accesscontrol.GetOrgRoles(f.user))
	rolesFilter := "AND role_id IN(SELECT distinct id FROM role " + filter + ")"
	var args []interface{}
	builder := strings.Builder{}
	builder.WriteRune('(')
	if len(f.dashboardActions) > 0 {
		actionsToCheck := make([]interface{}, 0, len(f.dashboardActions))
		for _, action := range f.dashboardActions {
			var hasWildcard bool
			for _, scope := range f.user.Permissions[f.user.OrgID][action] {
				if dashWildcards.Contains(scope) || folderWildcards.Contains(scope) {
					hasWildcard = true
					break
				}
			}
			if !hasWildcard {
				actionsToCheck = append(actionsToCheck, action)
			}
		}

		if len(actionsToCheck) > 0 {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 16) FROM permission WHERE action IN (?" + strings.Repeat(", ?", len(actionsToCheck)-1) + ") AND scope LIKE 'dashboards:uid:%' " + rolesFilter + " GROUP BY role_id, scope HAVING COUNT(action) = ?) AND NOT dashboard.is_folder)")
			args = append(args, actionsToCheck...)
			args = append(args, params...)
			args = append(args, len(actionsToCheck))

			builder.WriteString(" OR ")
			builder.WriteString("(dashboard.folder_id IN (SELECT id FROM dashboard as d WHERE d.uid IN (SELECT substr(scope, 13) FROM permission WHERE action IN (?" + strings.Repeat(", ?", len(actionsToCheck)-1) + ") AND scope LIKE 'folders:uid:%' " + rolesFilter + " GROUP BY role_id, scope HAVING COUNT(action) = ?)) AND NOT dashboard.is_folder)")
			args = append(args, actionsToCheck...)
			args = append(args, params...)
			args = append(args, len(actionsToCheck))
		} else {
			builder.WriteString("NOT dashboard.is_folder")
		}
	}

	if len(f.folderActions) > 0 {
		if len(f.dashboardActions) > 0 {
			builder.WriteString(" OR ")
		}

		actionsToCheck := make([]interface{}, 0, len(f.folderActions))
		for _, action := range f.folderActions {
			var hasWildcard bool
			for _, scope := range f.user.Permissions[f.user.OrgID][action] {
				if folderWildcards.Contains(scope) {
					hasWildcard = true
					break
				}
			}
			if !hasWildcard {
				actionsToCheck = append(actionsToCheck, action)
			}
		}

		if len(actionsToCheck) > 0 {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 13) FROM permission WHERE action IN (?" + strings.Repeat(", ?", len(actionsToCheck)-1) + ") AND scope LIKE 'folders:uid:%' " + rolesFilter + " GROUP BY role_id, scope HAVING COUNT(action) = ?) AND dashboard.is_folder)")
			args = append(args, actionsToCheck...)
			args = append(args, params...)
			args = append(args, len(actionsToCheck))
		} else {
			builder.WriteString("dashboard.is_folder")
		}
	}
	builder.WriteRune(')')
	return builder.String(), args
}
