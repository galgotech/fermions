package sqlstore

import (
	"bytes"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSqlBuilder(cfg *setting.Cfg) SQLBuilder {
	return SQLBuilder{cfg: cfg}
}

type SQLBuilder struct {
	cfg    *setting.Cfg
	sql    bytes.Buffer
	params []interface{}
}

func (sb *SQLBuilder) Write(sql string, params ...interface{}) {
	sb.sql.WriteString(sql)

	if len(params) > 0 {
		sb.params = append(sb.params, params...)
	}
}

func (sb *SQLBuilder) GetSQLString() string {
	return sb.sql.String()
}

func (sb *SQLBuilder) GetParams() []interface{} {
	return sb.params
}

func (sb *SQLBuilder) AddParams(params ...interface{}) {
	sb.params = append(sb.params, params...)
}

func (sb *SQLBuilder) WriteDashboardPermissionFilter(user *user.SignedInUser, permission models.PermissionType) {
	sql, params := permissions.NewAccessControlDashboardPermissionFilter(user, permission, "").Where()
	sb.sql.WriteString(" AND " + sql)
	sb.params = append(sb.params, params...)
}
