package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrGuardianPermissionExists = errors.New("permission already exists")
	ErrGuardianOverride         = errors.New("you can only override a permission to be higher")
)

// DashboardGuardian to be used for guard against operations without access on dashboard and acl
type DashboardGuardian interface {
	CanSave() (bool, error)
	CanEdit() (bool, error)
	CanView() (bool, error)
	CanAdmin() (bool, error)
	CanDelete() (bool, error)
	CanCreate(folderID int64, isFolder bool) (bool, error)
	CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardACL) (bool, error)

	// GetACL returns ACL.
	GetACL() ([]*models.DashboardACLInfoDTO, error)

	// GetACLWithoutDuplicates returns ACL and strips any permission
	// that already has an inherited permission with higher or equal
	// permission.
	GetACLWithoutDuplicates() ([]*models.DashboardACLInfoDTO, error)
	GetHiddenACL(*setting.Cfg) ([]*models.DashboardACL, error)
}

// New factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) DashboardGuardian {
	panic("no guardian factory implementation provided")
}
