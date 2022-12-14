// Package api Grafana HTTP API.
//
// The Grafana backend exposes an HTTP API, the same API is used by the frontend to do
// everything from saving dashboards, creating users and updating data sources.
//
//	Schemes: http, https
//	BasePath: /api
//	Version: 0.0.1
//	Contact: Grafana Labs<hello@grafana.com> https://grafana.com
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
//	Security:
//	- basic:
//	- api_key:
//
//	SecurityDefinitions:
//	basic:
//	 type: basic
//	api_key:
//	 type: apiKey
//	 name: Authorization
//	 in: header
//
// swagger:meta
package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/user"
)

var plog = log.New("api")

// registerRoutes registers all API HTTP routes.
func (hs *HTTPServer) registerRoutes() {
	reqSignedIn := middleware.ReqSignedIn
	reqNotSignedIn := middleware.ReqNotSignedIn
	reqSignedInNoAnonymous := middleware.ReqSignedInNoAnonymous
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin
	reqOrgAdmin := middleware.ReqOrgAdmin
	authorize := ac.Middleware(hs.AccessControl)
	authorizeInOrg := ac.AuthorizeInOrgMiddleware(hs.AccessControl, hs.accesscontrolService, hs.userService)
	quota := middleware.Quota(hs.QuotaService)
	setPublicDashboardFlag := middleware.SetPublicDashboardFlag

	r := hs.RouteRegister

	// not logged in views
	r.Get("/logout", hs.Logout)
	r.Post("/login", quota(string(auth.QuotaTargetSrv)), routing.Wrap(hs.LoginPost))
	r.Get("/login/:name", quota(string(auth.QuotaTargetSrv)), hs.OAuthLogin)
	r.Get("/login", hs.LoginView)
	r.Get("/invite/:code", hs.Index)

	// authed views
	r.Get("/", reqSignedIn, hs.Index)
	r.Get("/profile/", reqSignedInNoAnonymous, hs.Index)
	r.Get("/profile/password", reqSignedInNoAnonymous, hs.Index)
	r.Get("/.well-known/change-password", redirectToChangePassword)
	r.Get("/profile/switch-org/:id", reqSignedInNoAnonymous, hs.ChangeActiveOrgAndRedirectToHome)
	r.Get("/org/", authorize(ac.OrgPreferencesAccessEvaluator), hs.Index)
	r.Get("/org/new", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsCreateAccessEvaluator), hs.Index)
	r.Get("/org/users", authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), hs.Index)
	r.Get("/org/teams", authorize(ac.EvalPermission(ac.ActionTeamsRead)), hs.Index)
	r.Get("/org/teams/edit/*", authorize(ac.TeamsEditAccessEvaluator), hs.Index)
	r.Get("/org/teams/new", authorize(ac.EvalPermission(ac.ActionTeamsCreate)), hs.Index)
	r.Get("/org/serviceaccounts", authorize(ac.EvalPermission(serviceaccounts.ActionRead)), hs.Index)
	r.Get("/org/serviceaccounts/:serviceAccountId", authorize(ac.EvalPermission(serviceaccounts.ActionRead)), hs.Index)
	r.Get("/org/apikeys/", authorize(ac.EvalPermission(ac.ActionAPIKeyRead)), hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/settings", authorize(ac.EvalPermission(ac.ActionSettingsRead)), hs.Index)
	// Show the combined users page for org admins if topnav is enabled
	if hs.Features.IsEnabled(featuremgmt.FlagTopnav) {
		r.Get("/admin/users", authorize(ac.EvalAny(ac.EvalPermission(ac.ActionOrgUsersRead), ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll))), hs.Index)
	} else {
		r.Get("/admin/users", authorize(ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), hs.Index)
	}
	r.Get("/admin/users/create", authorize(ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/admin/users/edit/:id", authorize(ac.EvalPermission(ac.ActionUsersRead)), hs.Index)
	r.Get("/admin/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsAccessEvaluator), hs.Index)
	r.Get("/admin/orgs/edit/:id", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsAccessEvaluator), hs.Index)
	r.Get("/admin/stats", authorize(ac.EvalPermission(ac.ActionServerStatsRead)), hs.Index)
	r.Get("/admin/storage/*", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/ldap", authorize(ac.EvalPermission(ac.ActionLDAPStatusRead)), hs.Index)

	r.Get("/live", reqGrafanaAdmin, hs.Index)
	r.Get("/live/pipeline", reqGrafanaAdmin, hs.Index)
	r.Get("/live/cloud", reqGrafanaAdmin, hs.Index)

	// App Root Page
	appPluginIDScope := plugins.ScopeProvider.GetResourceScope(ac.Parameter(":id"))
	r.Get("/a/:id/*", authorize(ac.EvalPermission(plugins.ActionAppAccess, appPluginIDScope)), hs.Index)
	r.Get("/a/:id", authorize(ac.EvalPermission(plugins.ActionAppAccess, appPluginIDScope)), hs.Index)

	r.Get("/d/:uid/:slug", reqSignedIn, hs.Index)
	r.Get("/d/:uid", reqSignedIn, hs.Index)
	r.Get("/dashboard/script/*", reqSignedIn, hs.Index)
	r.Get("/dashboard/new", reqSignedIn, hs.Index)
	r.Get("/import/dashboard", reqSignedIn, hs.Index)
	r.Get("/dashboards/", reqSignedIn, hs.Index)
	r.Get("/dashboards/*", reqSignedIn, hs.Index)

	if hs.Features.IsEnabled(featuremgmt.FlagDashboardsFromStorage) {
		r.Get("/g/*", reqSignedIn, hs.Index)
	}

	r.Get("/p/:uid/:slug", setPublicDashboardFlag, hs.Index)
	r.Get("/p/:uid", setPublicDashboardFlag, hs.Index)

	r.Get("/library-panels/", reqSignedIn, hs.Index)
	r.Get("/monitoring/", reqSignedIn, hs.Index)
	r.Get("/monitoring/*", reqSignedIn, hs.Index)

	// sign up
	r.Get("/verify", hs.Index)
	r.Get("/signup", hs.Index)
	r.Get("/api/user/signup/options", routing.Wrap(GetSignUpOptions))
	r.Post("/api/user/signup", quota(user.QuotaTargetSrv), quota(org.QuotaTargetSrv), routing.Wrap(hs.SignUp))
	r.Post("/api/user/signup/step2", routing.Wrap(hs.SignUpStep2))

	// invited
	r.Get("/api/user/invite/:code", routing.Wrap(hs.GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", routing.Wrap(hs.CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", reqNotSignedIn, hs.Index)
	r.Get("/user/password/reset", hs.Index)

	r.Post("/api/user/password/send-reset-email", routing.Wrap(hs.SendResetPasswordEmail))
	r.Post("/api/user/password/reset", routing.Wrap(hs.ResetPassword))

	// api renew session based on cookie
	r.Get("/api/login/ping", quota(string(auth.QuotaTargetSrv)), routing.Wrap(hs.LoginAPIPing))

	// expose plugin file system assets
	r.Get("/public/plugins/:pluginId/*", hs.getPluginAssets)

	if hs.Features.IsEnabled(featuremgmt.FlagSwaggerUi) {
		r.Get("/swagger-ui", swaggerUI)
		r.Get("/openapi3", openapi3)
	}

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {
		// user (signed in)
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/", routing.Wrap(hs.GetSignedInUser))
			userRoute.Put("/", routing.Wrap(hs.UpdateSignedInUser))
			userRoute.Post("/using/:id", routing.Wrap(hs.UserSetUsingOrg))
			userRoute.Get("/orgs", routing.Wrap(hs.GetSignedInUserOrgList))
			userRoute.Get("/teams", routing.Wrap(hs.GetSignedInUserTeamList))

			userRoute.Get("/stars", routing.Wrap(hs.GetStars))
			// Deprecated: use /stars/dashboard/uid/:uid API instead.
			userRoute.Post("/stars/dashboard/:id", routing.Wrap(hs.StarDashboard))
			// Deprecated: use /stars/dashboard/uid/:uid API instead.
			userRoute.Delete("/stars/dashboard/:id", routing.Wrap(hs.UnstarDashboard))

			userRoute.Post("/stars/dashboard/uid/:uid", routing.Wrap(hs.StarDashboardByUID))
			userRoute.Delete("/stars/dashboard/uid/:uid", routing.Wrap(hs.UnstarDashboardByUID))

			userRoute.Put("/password", routing.Wrap(hs.ChangeUserPassword))
			userRoute.Get("/quotas", routing.Wrap(hs.GetUserQuotas))
			userRoute.Put("/helpflags/:id", routing.Wrap(hs.SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", routing.Wrap(hs.ClearHelpFlags))

			userRoute.Get("/preferences", routing.Wrap(hs.GetUserPreferences))
			userRoute.Put("/preferences", routing.Wrap(hs.UpdateUserPreferences))
			userRoute.Patch("/preferences", routing.Wrap(hs.PatchUserPreferences))

			userRoute.Get("/auth-tokens", routing.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", routing.Wrap(hs.RevokeUserAuthToken))
		}, reqSignedInNoAnonymous)

		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			userIDScope := ac.Scope("global.users", "id", ac.Parameter(":id"))
			usersRoute.Get("/", authorize(ac.EvalPermission(ac.ActionUsersRead)), routing.Wrap(hs.searchUsersService.SearchUsers))
			usersRoute.Get("/search", authorize(ac.EvalPermission(ac.ActionUsersRead)), routing.Wrap(hs.searchUsersService.SearchUsersWithPaging))
			usersRoute.Get("/:id", authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserByID))
			usersRoute.Get("/:id/teams", authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserTeams))
			usersRoute.Get("/:id/orgs", authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", authorize(ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.GetUserByLoginOrEmail))
			usersRoute.Put("/:id", authorize(ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUser))
			usersRoute.Post("/:id/using/:orgId", authorize(ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUserActiveOrg))
		})

		// team (admin permission required)
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Post("/", authorize(ac.EvalPermission(ac.ActionTeamsCreate)), routing.Wrap(hs.CreateTeam))
			teamsRoute.Put("/:teamId", authorize(ac.EvalPermission(ac.ActionTeamsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeam))
			teamsRoute.Delete("/:teamId", authorize(ac.EvalPermission(ac.ActionTeamsDelete, ac.ScopeTeamsID)), routing.Wrap(hs.DeleteTeamByID))
			teamsRoute.Get("/:teamId/members", authorize(ac.EvalPermission(ac.ActionTeamsPermissionsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamMembers))
			teamsRoute.Post("/:teamId/members", authorize(ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.AddTeamMember))
			teamsRoute.Put("/:teamId/members/:userId", authorize(ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeamMember))
			teamsRoute.Delete("/:teamId/members/:userId", authorize(ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.RemoveTeamMember))
			teamsRoute.Get("/:teamId/preferences", authorize(ac.EvalPermission(ac.ActionTeamsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamPreferences))
			teamsRoute.Put("/:teamId/preferences", authorize(ac.EvalPermission(ac.ActionTeamsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeamPreferences))
		})

		// team without requirement of user to be org admin
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Get("/:teamId", authorize(ac.EvalPermission(ac.ActionTeamsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamByID))
			teamsRoute.Get("/search", authorize(ac.EvalPermission(ac.ActionTeamsRead)), routing.Wrap(hs.SearchTeams))
		})

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/", authorize(ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetCurrentOrg))
			orgRoute.Get("/quotas", authorize(ac.EvalPermission(ac.ActionOrgsQuotasRead)), routing.Wrap(hs.GetCurrentOrgQuotas))
		})

		if hs.Features.IsEnabled(featuremgmt.FlagPanelTitleSearch) {
			apiRoute.Group("/search-v2", hs.SearchV2HTTPService.RegisterHTTPRoutes)
		}

		if hs.QueryLibraryHTTPService != nil && !hs.QueryLibraryHTTPService.IsDisabled() {
			apiRoute.Group("/query-library", hs.QueryLibraryHTTPService.RegisterHTTPRoutes)
		}

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgRoute.Put("/", authorize(ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrg))
			orgRoute.Put("/address", authorize(ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrgAddress))
			orgRoute.Get("/users", authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Get("/users/search", authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.SearchOrgUsersWithPaging))
			orgRoute.Post("/users", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), quota(user.QuotaTargetSrv), quota(org.QuotaTargetSrv), routing.Wrap(hs.AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", authorize(ac.EvalPermission(ac.ActionOrgUsersWrite, userIDScope)), routing.Wrap(hs.UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", authorize(ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), routing.Wrap(hs.GetPendingOrgInvites))
			orgRoute.Post("/invites", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), quota(user.QuotaTargetSrv), quota(user.QuotaTargetSrv), routing.Wrap(hs.AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), routing.Wrap(hs.RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesRead)), routing.Wrap(hs.GetOrgPreferences))
			orgRoute.Put("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesWrite)), routing.Wrap(hs.UpdateOrgPreferences))
			orgRoute.Patch("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesWrite)), routing.Wrap(hs.PatchOrgPreferences))
		})

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			lookupEvaluator := func() ac.Evaluator {
				if hs.License.FeatureEnabled("accesscontrol.enforcement") {
					return ac.EvalPermission(ac.ActionOrgUsersRead)
				}
				// For oss we allow users with access to update permissions on either folders, teams or dashboards to perform the lookup
				return ac.EvalAny(
					ac.EvalPermission(ac.ActionOrgUsersRead),
					ac.EvalPermission(ac.ActionTeamsPermissionsWrite),
					ac.EvalPermission(dashboards.ActionFoldersPermissionsWrite),
					ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite),
				)
			}
			orgRoute.Get("/users/lookup", authorize(lookupEvaluator()), routing.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsCreate)), quota(org.QuotaTargetSrv), routing.Wrap(hs.CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgsRoute.Get("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetOrgByID))
			orgsRoute.Put("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateOrg))
			orgsRoute.Put("/address", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateOrgAddress))
			orgsRoute.Delete("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsDelete)), routing.Wrap(hs.DeleteOrgByID))
			orgsRoute.Get("/users", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsers))
			orgsRoute.Post("/users", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), routing.Wrap(hs.AddOrgUser))
			orgsRoute.Patch("/users/:userId", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersWrite, userIDScope)), routing.Wrap(hs.UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUser))
			orgsRoute.Get("/quotas", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsQuotasRead)), routing.Wrap(hs.GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsQuotasWrite)), routing.Wrap(hs.UpdateOrgQuota))
		})

		// orgs (admin routes)
		apiRoute.Get("/orgs/name/:name/", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetOrgByName))

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute routing.RouteRegister) {
			apikeyIDScope := ac.Scope("apikeys", "id", ac.Parameter(":id"))
			keysRoute.Get("/", authorize(ac.EvalPermission(ac.ActionAPIKeyRead)), routing.Wrap(hs.GetAPIKeys))
			keysRoute.Post("/", authorize(ac.EvalPermission(ac.ActionAPIKeyCreate)), quota(string(apikey.QuotaTargetSrv)), routing.Wrap(hs.AddAPIKey))
			keysRoute.Delete("/:id", authorize(ac.EvalPermission(ac.ActionAPIKeyDelete, apikeyIDScope)), routing.Wrap(hs.DeleteAPIKey))
		})

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", routing.Wrap(hs.SetHomeDashboard))
		})

		pluginIDScope := plugins.ScopeProvider.GetResourceScope(ac.Parameter(":pluginId"))
		apiRoute.Get("/plugins", routing.Wrap(hs.GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", routing.Wrap(hs.GetPluginSettingByID)) // RBAC check performed in handler for App Plugins
		apiRoute.Get("/plugins/:pluginId/markdown/:name", routing.Wrap(hs.GetPluginMarkdown))
		apiRoute.Get("/plugins/errors", routing.Wrap(hs.GetPluginErrorsList))

		if hs.Cfg.PluginAdminEnabled && !hs.Cfg.PluginAdminExternalManageEnabled {
			apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
				pluginRoute.Post("/:pluginId/install", authorize(ac.EvalPermission(plugins.ActionInstall)), routing.Wrap(hs.InstallPlugin))
				pluginRoute.Post("/:pluginId/uninstall", authorize(ac.EvalPermission(plugins.ActionInstall)), routing.Wrap(hs.UninstallPlugin))
			})
		}

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", reqOrgAdmin, routing.Wrap(hs.GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", authorize(ac.EvalPermission(plugins.ActionWrite, pluginIDScope)), routing.Wrap(hs.UpdatePluginSetting))
		})

		apiRoute.Get("/frontend/settings/", hs.GetFrontendSettings)

		// Folders
		apiRoute.Group("/folders", func(folderRoute routing.RouteRegister) {
			idScope := dashboards.ScopeFoldersProvider.GetResourceScope(ac.Parameter(":id"))
			uidScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":uid"))
			folderRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionFoldersRead)), routing.Wrap(hs.GetFolders))
			folderRoute.Get("/id/:id", authorize(ac.EvalPermission(dashboards.ActionFoldersRead, idScope)), routing.Wrap(hs.GetFolderByID))
			folderRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionFoldersCreate)), routing.Wrap(hs.CreateFolder))

			folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
				folderUidRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionFoldersRead, uidScope)), routing.Wrap(hs.GetFolderByUID))
				folderUidRoute.Put("/", authorize(ac.EvalPermission(dashboards.ActionFoldersWrite, uidScope)), routing.Wrap(hs.UpdateFolder))
				folderUidRoute.Post("/move", authorize(ac.EvalPermission(dashboards.ActionFoldersWrite, uidScope)), routing.Wrap(hs.MoveFolder))
				folderUidRoute.Delete("/", authorize(ac.EvalPermission(dashboards.ActionFoldersDelete, uidScope)), routing.Wrap(hs.DeleteFolder))

				folderUidRoute.Group("/permissions", func(folderPermissionRoute routing.RouteRegister) {
					folderPermissionRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionFoldersPermissionsRead, uidScope)), routing.Wrap(hs.GetFolderPermissionList))
					folderPermissionRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionFoldersPermissionsWrite, uidScope)), routing.Wrap(hs.UpdateFolderPermissions))
				})
			})
		})

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/uid/:uid", authorize(ac.EvalPermission(dashboards.ActionDashboardsRead)), routing.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/uid/:uid", authorize(ac.EvalPermission(dashboards.ActionDashboardsDelete)), routing.Wrap(hs.DeleteDashboardByUID))
			dashboardRoute.Group("/uid/:uid", func(dashUidRoute routing.RouteRegister) {
				dashUidRoute.Get("/versions", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.GetDashboardVersions))
				dashUidRoute.Post("/restore", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.RestoreDashboardVersion))
				dashUidRoute.Get("/versions/:id", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.GetDashboardVersion))
				dashUidRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsRead)), routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite)), routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})

			dashboardRoute.Post("/calculate-diff", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.CalculateDashboardDiff))
			dashboardRoute.Post("/validate", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.ValidateDashboard))
			dashboardRoute.Post("/trim", routing.Wrap(hs.TrimDashboard))

			dashboardRoute.Post("/db", authorize(ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionDashboardsWrite))), routing.Wrap(hs.PostDashboard))
			dashboardRoute.Get("/home", routing.Wrap(hs.GetHomeDashboard))
			dashboardRoute.Get("/tags", hs.GetDashboardTags)

			// Deprecated: used to convert internal IDs to UIDs
			dashboardRoute.Get("/ids/:ids", authorize(ac.EvalPermission(dashboards.ActionDashboardsRead)), hs.GetDashboardUIDs)

			// Deprecated: use /uid/:uid API instead.
			dashboardRoute.Group("/id/:dashboardId", func(dashIdRoute routing.RouteRegister) {
				dashIdRoute.Get("/versions", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.GetDashboardVersions))
				dashIdRoute.Get("/versions/:id", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.GetDashboardVersion))
				dashIdRoute.Post("/restore", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.RestoreDashboardVersion))

				dashIdRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsRead)), routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite)), routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})
		})

		// Search
		apiRoute.Get("/search/sorting", routing.Wrap(hs.ListSortOptions))
		apiRoute.Get("/search/", routing.Wrap(hs.Search))

		apiRoute.Post("/frontend-metrics", routing.Wrap(hs.PostFrontendMetrics))

		apiRoute.Group("/live", func(liveRoute routing.RouteRegister) {
			// the channel path is in the name
			liveRoute.Post("/publish", routing.Wrap(hs.Live.HandleHTTPPublish))

			// POST influx line protocol.
			liveRoute.Post("/push/:streamId", hs.LivePushGateway.Handle)

			// List available streams and fields
			liveRoute.Get("/list", routing.Wrap(hs.Live.HandleListHTTP))

			// Some channels may have info
			liveRoute.Get("/info/*", routing.Wrap(hs.Live.HandleInfoHTTP))

			if hs.Features.IsEnabled(featuremgmt.FlagLivePipeline) {
				// POST Live data to be processed according to channel rules.
				liveRoute.Post("/pipeline/push/*", hs.LivePushGateway.HandlePipelinePush)
				liveRoute.Post("/pipeline-convert-test", routing.Wrap(hs.Live.HandlePipelineConvertTestHTTP), reqOrgAdmin)
				liveRoute.Get("/pipeline-entities", routing.Wrap(hs.Live.HandlePipelineEntitiesListHTTP), reqOrgAdmin)
				liveRoute.Get("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesListHTTP), reqOrgAdmin)
				liveRoute.Post("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesPostHTTP), reqOrgAdmin)
				liveRoute.Put("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesPutHTTP), reqOrgAdmin)
				liveRoute.Delete("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesDeleteHTTP), reqOrgAdmin)
				liveRoute.Get("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsListHTTP), reqOrgAdmin)
				liveRoute.Post("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsPostHTTP), reqOrgAdmin)
				liveRoute.Put("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsPutHTTP), reqOrgAdmin)
				liveRoute.Delete("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsDeleteHTTP), reqOrgAdmin)
			}
		})

		apiRoute.Group("/comments", func(commentRoute routing.RouteRegister) {
			commentRoute.Post("/get", routing.Wrap(hs.commentsGet))
			commentRoute.Post("/create", routing.Wrap(hs.commentsCreate))
		})
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Get("/settings", authorize(ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(hs.AdminGetSettings))
		if hs.Features.IsEnabled(featuremgmt.FlagShowFeatureFlagsInUI) {
			adminRoute.Get("/settings/features", authorize(ac.EvalPermission(ac.ActionSettingsRead)), hs.Features.HandleGetSettings)
		}
		adminRoute.Get("/stats", authorize(ac.EvalPermission(ac.ActionServerStatsRead)), routing.Wrap(hs.AdminGetStats))

		adminRoute.Post("/provisioning/dashboards/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersDashboards)), routing.Wrap(hs.AdminProvisioningReloadDashboards))
		adminRoute.Post("/provisioning/plugins/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersPlugins)), routing.Wrap(hs.AdminProvisioningReloadPlugins))

		adminRoute.Post("/ldap/reload", authorize(ac.EvalPermission(ac.ActionLDAPConfigReload)), routing.Wrap(hs.ReloadLDAPCfg))
		adminRoute.Post("/ldap/sync/:id", authorize(ac.EvalPermission(ac.ActionLDAPUsersSync)), routing.Wrap(hs.PostSyncUserWithLDAP))
		adminRoute.Get("/ldap/:username", authorize(ac.EvalPermission(ac.ActionLDAPUsersRead)), routing.Wrap(hs.GetUserFromLDAP))
		adminRoute.Get("/ldap/status", authorize(ac.EvalPermission(ac.ActionLDAPStatusRead)), routing.Wrap(hs.GetLDAPStatus))
	})

	// Administering users
	r.Group("/api/admin/users", func(adminUserRoute routing.RouteRegister) {
		userIDScope := ac.Scope("global.users", "id", ac.Parameter(":id"))

		adminUserRoute.Post("/", authorize(ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(hs.AdminCreateUser))
		adminUserRoute.Put("/:id/password", authorize(ac.EvalPermission(ac.ActionUsersPasswordUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPassword))
		adminUserRoute.Put("/:id/permissions", authorize(ac.EvalPermission(ac.ActionUsersPermissionsUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPermissions))
		adminUserRoute.Delete("/:id", authorize(ac.EvalPermission(ac.ActionUsersDelete, userIDScope)), routing.Wrap(hs.AdminDeleteUser))
		adminUserRoute.Post("/:id/disable", authorize(ac.EvalPermission(ac.ActionUsersDisable, userIDScope)), routing.Wrap(hs.AdminDisableUser))
		adminUserRoute.Post("/:id/enable", authorize(ac.EvalPermission(ac.ActionUsersEnable, userIDScope)), routing.Wrap(hs.AdminEnableUser))
		adminUserRoute.Get("/:id/quotas", authorize(ac.EvalPermission(ac.ActionUsersQuotasList, userIDScope)), routing.Wrap(hs.GetUserQuotas))
		adminUserRoute.Put("/:id/quotas/:target", authorize(ac.EvalPermission(ac.ActionUsersQuotasUpdate, userIDScope)), routing.Wrap(hs.UpdateUserQuota))

		adminUserRoute.Post("/:id/logout", authorize(ac.EvalPermission(ac.ActionUsersLogout, userIDScope)), routing.Wrap(hs.AdminLogoutUser))
		adminUserRoute.Get("/:id/auth-tokens", authorize(ac.EvalPermission(ac.ActionUsersAuthTokenList, userIDScope)), routing.Wrap(hs.AdminGetUserAuthTokens))
		adminUserRoute.Post("/:id/revoke-auth-token", authorize(ac.EvalPermission(ac.ActionUsersAuthTokenUpdate, userIDScope)), routing.Wrap(hs.AdminRevokeUserAuthToken))
	})

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, hs.ProxyGnetRequest)

	// Gravatar service
	r.Get("/avatar/:hash", hs.AvatarCacheServer.Handler)
}
