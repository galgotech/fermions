//go:build wireinject
// +build wireinject

package runner

import (
	"context"

	"github.com/google/wire"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	loginpkg "github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware/csrf"
	"github.com/grafana/grafana/pkg/models"
	pluginDashboards "github.com/grafana/grafana/pkg/plugins/manager/dashboards"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/comments"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	dashboardimportservice "github.com/grafana/grafana/pkg/services/dashboardimport/service"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/dashboardversion/dashverimpl"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	authinfodatabase "github.com/grafana/grafana/pkg/services/login/authinfoservice/database"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattemptimpl"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	plugindashboardsservice "github.com/grafana/grafana/pkg/services/plugindashboards/service"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/preference/prefimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	serviceaccountsmanager "github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star/starimpl"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/teamguardian"
	teamguardianDatabase "github.com/grafana/grafana/pkg/services/teamguardian/database"
	teamguardianManager "github.com/grafana/grafana/pkg/services/teamguardian/manager"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var wireSet = wire.NewSet(
	New,
	localcache.ProvideService,
	tracing.ProvideService,
	bus.ProvideBus,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	db.ProvideService,
	wire.InterfaceValue(new(usagestats.Service), noOpUsageStats{}),
	wire.InterfaceValue(new(routing.RouteRegister), noOpRouteRegister{}),
	encryptionservice.ProvideEncryptionService,
	wire.Bind(new(encryption.Internal), new(*encryptionservice.Service)),
	secretsDatabase.ProvideSecretsStore,
	wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
	hooks.ProvideService,
	api.ProvideHTTPServer,
	kvstore.ProvideService,
	updatechecker.ProvideGrafanaService,
	updatechecker.ProvidePluginsService,
	uss.ProvideService,
	pluginsintegration.WireSet,
	pluginDashboards.ProvideFileStoreManager,
	wire.Bind(new(pluginDashboards.FileStore), new(*pluginDashboards.FileStoreManager)),
	store.ProvideEntityEventsService,
	httpclientprovider.New,
	wire.Bind(new(httpclient.Provider), new(*sdkhttpclient.Provider)),
	serverlock.ProvideService,
	cleanup.ProvideService,
	shorturls.ProvideService,
	wire.Bind(new(shorturls.Service), new(*shorturls.ShortURLService)),
	quotaimpl.ProvideService,
	remotecache.ProvideService,
	loginservice.ProvideService,
	wire.Bind(new(login.Service), new(*loginservice.Implementation)),
	authinfoservice.ProvideAuthInfoService,
	wire.Bind(new(login.AuthInfoService), new(*authinfoservice.Implementation)),
	authinfodatabase.ProvideAuthInfoStore,
	loginpkg.ProvideService,
	wire.Bind(new(loginpkg.Authenticator), new(*loginpkg.AuthenticatorService)),
	loginattemptimpl.ProvideService,
	wire.Bind(new(loginattempt.Service), new(*loginattemptimpl.Service)),
	search.ProvideService,
	searchV2.ProvideService,
	store.ProvideService,
	live.ProvideService,
	pushhttp.ProvideService,
	contexthandler.ProvideService,
	jwt.ProvideService,
	wire.Bind(new(models.JWTService), new(*jwt.AuthService)),
	librarypanels.ProvideService,
	wire.Bind(new(librarypanels.Service), new(*librarypanels.LibraryPanelService)),
	libraryelements.ProvideService,
	wire.Bind(new(libraryelements.Service), new(*libraryelements.LibraryElementService)),
	notifications.ProvideService,
	notifications.ProvideSmtpService,
	metrics.ProvideService,
	social.ProvideService,
	wire.Bind(new(social.Service), new(*social.SocialService)),
	oauthtoken.ProvideService,
	wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtoken.Service)),
	pluginSettings.ProvideService,
	wire.Bind(new(pluginsettings.Service), new(*pluginSettings.Service)),
	database.ProvideServiceAccountsStore,
	wire.Bind(new(serviceaccounts.Store), new(*database.ServiceAccountsStoreImpl)),
	ossaccesscontrol.ProvideServiceAccountPermissions,
	wire.Bind(new(accesscontrol.ServiceAccountPermissionsService), new(*ossaccesscontrol.ServiceAccountPermissionsService)),
	serviceaccountsmanager.ProvideServiceAccountsService,
	wire.Bind(new(serviceaccounts.Service), new(*serviceaccountsmanager.ServiceAccountsService)),
	teamguardianDatabase.ProvideTeamGuardianStore,
	wire.Bind(new(teamguardian.Store), new(*teamguardianDatabase.TeamGuardianStoreImpl)),
	teamguardianManager.ProvideService,
	dashboardservice.ProvideDashboardService,
	dashboardstore.ProvideDashboardStore,
	wire.Bind(new(dashboards.DashboardService), new(*dashboardservice.DashboardServiceImpl)),
	wire.Bind(new(dashboards.DashboardProvisioningService), new(*dashboardservice.DashboardServiceImpl)),
	wire.Bind(new(dashboards.PluginService), new(*dashboardservice.DashboardServiceImpl)),
	wire.Bind(new(dashboards.Store), new(*dashboardstore.DashboardStore)),
	dashboardimportservice.ProvideService,
	wire.Bind(new(dashboardimport.Service), new(*dashboardimportservice.ImportDashboardService)),
	plugindashboardsservice.ProvideService,
	wire.Bind(new(plugindashboards.Service), new(*plugindashboardsservice.Service)),
	plugindashboardsservice.ProvideDashboardUpdater,
	comments.ProvideService,
	guardian.ProvideService,
	avatar.ProvideAvatarCacheServer,
	authproxy.ProvideAuthProxy,
	statscollector.ProvideService,
	corekind.KindSet,
	cuectx.GrafanaCUEContext,
	cuectx.GrafanaThemaRuntime,
	csrf.ProvideCSRFFilter,
	ossaccesscontrol.ProvideTeamPermissions,
	wire.Bind(new(accesscontrol.TeamPermissionsService), new(*ossaccesscontrol.TeamPermissionsService)),
	ossaccesscontrol.ProvideFolderPermissions,
	wire.Bind(new(accesscontrol.FolderPermissionsService), new(*ossaccesscontrol.FolderPermissionsService)),
	ossaccesscontrol.ProvideDashboardPermissions,
	wire.Bind(new(accesscontrol.DashboardPermissionsService), new(*ossaccesscontrol.DashboardPermissionsService)),
	starimpl.ProvideService,
	dashverimpl.ProvideService,
	userimpl.ProvideService,
	orgimpl.ProvideService,
	teamimpl.ProvideService,
	notifications.MockNotificationService,
	wire.Bind(new(notifications.TempUserStore), new(*dbtest.FakeDB)),
	wire.Bind(new(notifications.Service), new(*notifications.NotificationServiceMock)),
	wire.Bind(new(notifications.WebhookSender), new(*notifications.NotificationServiceMock)),
	wire.Bind(new(notifications.EmailSender), new(*notifications.NotificationServiceMock)),
	dbtest.NewFakeDB,
	wire.Bind(new(sqlstore.Store), new(*sqlstore.SQLStore)),
	wire.Bind(new(db.DB), new(*dbtest.FakeDB)),
	prefimpl.ProvideService,
	acimpl.ProvideAccessControl,
	wire.Bind(new(accesscontrol.AccessControl), new(*acimpl.AccessControl)),
	tagimpl.ProvideService,
	wire.Bind(new(tag.Service), new(*tagimpl.Service)),
)

func Initialize(cfg *setting.Cfg) (Runner, error) {
	wire.Build(wireExtsSet)
	return Runner{}, nil
}

// NoOp implementations of those dependencies that makes no sense to
// inject on CLI command executions (like the route registerer, for instance).

type noOpUsageStats struct{}

func (noOpUsageStats) GetUsageReport(context.Context) (usagestats.Report, error) {
	return usagestats.Report{}, nil
}

func (noOpUsageStats) RegisterMetricsFunc(_ usagestats.MetricsFunc) {}

func (noOpUsageStats) RegisterSendReportCallback(_ usagestats.SendReportCallbackFunc) {}

func (noOpUsageStats) ShouldBeReported(context.Context, string) bool { return false }

type noOpRouteRegister struct{}

func (noOpRouteRegister) Get(string, ...web.Handler) {}

func (noOpRouteRegister) Post(string, ...web.Handler) {}

func (noOpRouteRegister) Delete(string, ...web.Handler) {}

func (noOpRouteRegister) Put(string, ...web.Handler) {}

func (noOpRouteRegister) Patch(string, ...web.Handler) {}

func (noOpRouteRegister) Any(string, ...web.Handler) {}

func (noOpRouteRegister) Group(string, func(routing.RouteRegister), ...web.Handler) {}

func (noOpRouteRegister) Insert(string, func(routing.RouteRegister), ...web.Handler) {}

func (noOpRouteRegister) Register(routing.Router, ...routing.RegisterNamedMiddleware) {}

func (noOpRouteRegister) Reset() {}
