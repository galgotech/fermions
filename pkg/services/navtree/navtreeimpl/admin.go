package navtreeimpl

import (
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func (s *ServiceImpl) getOrgAdminNode(c *models.ReqContext) (*navtree.NavLink, error) {
	var configNodes []*navtree.NavLink

	hasAccess := ac.HasAccess(s.accessControl, c)

	if !s.features.IsEnabled(featuremgmt.FlagTopnav) {
		if hasAccess(ac.EvalPermission(ac.ActionOrgUsersRead)) {
			configNodes = append(configNodes, &navtree.NavLink{
				Text:     "Users",
				Id:       "users",
				SubTitle: "Invite and assign roles to users",
				Icon:     "user",
				Url:      s.cfg.AppSubURL + "/org/users",
			})
		}
	}

	if hasAccess(ac.TeamsAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Teams",
			Id:       "teams",
			SubTitle: "Groups of users that have common dashboard and permission needs",
			Icon:     "users-alt",
			Url:      s.cfg.AppSubURL + "/org/teams",
		})
	}

	if hasAccess(ac.OrgPreferencesAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Preferences",
			Id:       "org-settings",
			SubTitle: "Manage preferences across an organization",
			Icon:     "sliders-v-alt",
			Url:      s.cfg.AppSubURL + "/org",
		})
	}

	hideApiKeys, _, _ := s.kvStore.Get(c.Req.Context(), c.OrgID, "serviceaccounts", "hideApiKeys")
	apiKeys, err := s.apiKeyService.GetAllAPIKeys(c.Req.Context(), c.OrgID)
	if err != nil {
		return nil, err
	}

	apiKeysHidden := hideApiKeys == "1" && len(apiKeys) == 0
	if hasAccess(ac.ApiKeyAccessEvaluator) && !apiKeysHidden {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "API keys",
			Id:       "apikeys",
			SubTitle: "Manage and create API keys that are used to interact with Grafana HTTP APIs",
			Icon:     "key-skeleton-alt",
			Url:      s.cfg.AppSubURL + "/org/apikeys",
		})
	}

	if enableServiceAccount(s, c) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Service accounts",
			Id:       "serviceaccounts",
			SubTitle: "Use service accounts to run automated workloads in Grafana",
			Icon:     "gf-service-account",
			Url:      s.cfg.AppSubURL + "/org/serviceaccounts",
		})
	}

	configNode := &navtree.NavLink{
		Id:         navtree.NavIDCfg,
		Text:       "Configuration",
		SubTitle:   "Organization: " + c.OrgName,
		Icon:       "cog",
		Section:    navtree.NavSectionConfig,
		SortWeight: navtree.WeightConfig,
		Children:   configNodes,
	}

	return configNode, nil
}

func (s *ServiceImpl) getServerAdminNode(c *models.ReqContext) *navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)
	hasGlobalAccess := ac.HasGlobalAccess(s.accessControl, s.accesscontrolService, c)
	orgsAccessEvaluator := ac.EvalPermission(ac.ActionOrgsRead)
	adminNavLinks := []*navtree.NavLink{}

	if s.features.IsEnabled(featuremgmt.FlagTopnav) {
		if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionOrgUsersRead), ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll))) {
			adminNavLinks = append(adminNavLinks, &navtree.NavLink{
				Text: "Users", SubTitle: "Manage users in Grafana", Id: "global-users", Url: s.cfg.AppSubURL + "/admin/users", Icon: "user",
			})
		}
	} else {
		if hasAccess(ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)) {
			adminNavLinks = append(adminNavLinks, &navtree.NavLink{
				Text: "Users", SubTitle: "Manage and create users across the whole Grafana server", Id: "global-users", Url: s.cfg.AppSubURL + "/admin/users", Icon: "user",
			})
		}
	}

	if hasGlobalAccess(orgsAccessEvaluator) {
		adminNavLinks = append(adminNavLinks, &navtree.NavLink{
			Text: "Organizations", SubTitle: "Isolated instances of Grafana running on the same server", Id: "global-orgs", Url: s.cfg.AppSubURL + "/admin/orgs", Icon: "building",
		})
	}

	if hasAccess(ac.EvalPermission(ac.ActionSettingsRead)) {
		adminNavLinks = append(adminNavLinks, &navtree.NavLink{
			Text: "Settings", SubTitle: "View the settings defined in your Grafana config", Id: "server-settings", Url: s.cfg.AppSubURL + "/admin/settings", Icon: "sliders-v-alt",
		})
	}

	if s.cfg.LDAPEnabled && hasAccess(ac.EvalPermission(ac.ActionLDAPStatusRead)) {
		adminNavLinks = append(adminNavLinks, &navtree.NavLink{
			Text: "LDAP", Id: "ldap", Url: s.cfg.AppSubURL + "/admin/ldap", Icon: "book",
		})
	}

	adminNode := &navtree.NavLink{
		Text:       "Server admin",
		Id:         navtree.NavIDAdmin,
		Icon:       "shield",
		SortWeight: navtree.WeightAdmin,
		Section:    navtree.NavSectionConfig,
		Children:   adminNavLinks,
	}

	if len(adminNavLinks) > 0 {
		adminNode.Url = adminNavLinks[0].Url
	}

	return adminNode
}

func (s *ServiceImpl) ReqCanAdminTeams(c *models.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin || (s.cfg.EditorsCanAdmin && c.OrgRole == org.RoleEditor)
}

func enableServiceAccount(s *ServiceImpl, c *models.ReqContext) bool {
	hasAccess := ac.HasAccess(s.accessControl, c)
	return hasAccess(serviceaccounts.AccessEvaluator)
}
