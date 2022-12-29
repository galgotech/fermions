package middleware

import "github.com/grafana/grafana/pkg/models"

// SetPublicDashboardFlag Adds public dashboard flag on context
func SetPublicDashboardFlag(c *models.ReqContext) {
	c.IsPublicDashboardView = true
}
