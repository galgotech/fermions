package provisioning

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	plugifaces "github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/plugins"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(
	ac accesscontrol.AccessControl,
	cfg *setting.Cfg,
	sqlStore db.DB,
	pluginStore plugifaces.Store,
	encryptionService encryption.Internal,
	notificatonService *notifications.NotificationService,
	dashboardProvisioningService dashboardservice.DashboardProvisioningService,
	dashboardService dashboardservice.DashboardService,
	folderService folder.Service,
	pluginSettings pluginsettings.Service,
	searchService searchV2.SearchService,
	quotaService quota.Service,
	orgService org.Service,
) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		Cfg:                          cfg,
		SQLStore:                     sqlStore,
		ac:                           ac,
		pluginStore:                  pluginStore,
		EncryptionService:            encryptionService,
		NotificationService:          notificatonService,
		newDashboardProvisioner:      dashboards.New,
		provisionPlugins:             plugins.Provision,
		dashboardProvisioningService: dashboardProvisioningService,
		dashboardService:             dashboardService,
		pluginsSettings:              pluginSettings,
		searchService:                searchService,
		quotaService:                 quotaService,
		log:                          log.New("provisioning"),
		orgService:                   orgService,
	}
	return s, nil
}

type ProvisioningService interface {
	registry.BackgroundService
	RunInitProvisioners(ctx context.Context) error
	ProvisionPlugins(ctx context.Context) error
	ProvisionDashboards(ctx context.Context) error
	GetDashboardProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

// Add a public constructor for overriding service to be able to instantiate OSS as fallback
func NewProvisioningServiceImpl() *ProvisioningServiceImpl {
	logger := log.New("provisioning")
	return &ProvisioningServiceImpl{
		log:                     logger,
		newDashboardProvisioner: dashboards.New,
		provisionPlugins:        plugins.Provision,
	}
}

// Used for testing purposes
func newProvisioningServiceImpl(
	newDashboardProvisioner dashboards.DashboardProvisionerFactory,
	provisionPlugins func(context.Context, string, plugifaces.Store, pluginsettings.Service, org.Service) error,
) *ProvisioningServiceImpl {
	return &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionPlugins:        provisionPlugins,
	}
}

type ProvisioningServiceImpl struct {
	Cfg                          *setting.Cfg
	SQLStore                     db.DB
	orgService                   org.Service
	ac                           accesscontrol.AccessControl
	pluginStore                  plugifaces.Store
	EncryptionService            encryption.Internal
	NotificationService          *notifications.NotificationService
	log                          log.Logger
	pollingCtxCancel             context.CancelFunc
	newDashboardProvisioner      dashboards.DashboardProvisionerFactory
	dashboardProvisioner         dashboards.DashboardProvisioner
	provisionNotifiers           func(context.Context, string, org.Service, encryption.Internal, *notifications.NotificationService) error
	provisionPlugins             func(context.Context, string, plugifaces.Store, pluginsettings.Service, org.Service) error
	mutex                        sync.Mutex
	dashboardProvisioningService dashboardservice.DashboardProvisioningService
	dashboardService             dashboardservice.DashboardService
	pluginsSettings              pluginsettings.Service
	searchService                searchV2.SearchService
	quotaService                 quota.Service
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners(ctx context.Context) error {
	err := ps.ProvisionPlugins(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (ps *ProvisioningServiceImpl) Run(ctx context.Context) error {
	err := ps.ProvisionDashboards(ctx)
	if err != nil {
		ps.log.Error("Failed to provision dashboard", "error", err)
		return err
	}
	if ps.dashboardProvisioner.HasDashboardSources() {
		ps.searchService.TriggerReIndex()
	}

	for {
		// Wait for unlock. This is tied to new dashboardProvisioner to be instantiated before we start polling.
		ps.mutex.Lock()
		// Using background here because otherwise if root context was canceled the select later on would
		// non-deterministically take one of the route possibly going into one polling loop before exiting.
		pollingContext, cancelFun := context.WithCancel(context.Background())
		ps.pollingCtxCancel = cancelFun
		ps.dashboardProvisioner.PollChanges(pollingContext)
		ps.mutex.Unlock()

		select {
		case <-pollingContext.Done():
			// Polling was canceled.
			continue
		case <-ctx.Done():
			// Root server context was cancelled so cancel polling and leave.
			ps.cancelPolling()
			return ctx.Err()
		}
	}
}

func (ps *ProvisioningServiceImpl) ProvisionPlugins(ctx context.Context) error {
	appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
	if err := ps.provisionPlugins(ctx, appPath, ps.pluginStore, ps.pluginsSettings, ps.orgService); err != nil {
		err = fmt.Errorf("%v: %w", "app provisioning error", err)
		ps.log.Error("Failed to provision plugins", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionDashboards(ctx context.Context) error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(ctx, dashboardPath, ps.dashboardProvisioningService, ps.orgService, ps.dashboardService)
	if err != nil {
		return fmt.Errorf("%v: %w", "Failed to create provisioner", err)
	}

	ps.mutex.Lock()
	defer ps.mutex.Unlock()

	ps.cancelPolling()
	dashProvisioner.CleanUpOrphanedDashboards(ctx)

	err = dashProvisioner.Provision(ctx)
	if err != nil {
		// If we fail to provision with the new provisioner, the mutex will unlock and the polling will restart with the
		// old provisioner as we did not switch them yet.
		return fmt.Errorf("%v: %w", "Failed to provision dashboards", err)
	}
	ps.dashboardProvisioner = dashProvisioner
	return nil
}

func (ps *ProvisioningServiceImpl) GetDashboardProvisionerResolvedPath(name string) string {
	return ps.dashboardProvisioner.GetProvisionerResolvedPath(name)
}

func (ps *ProvisioningServiceImpl) GetAllowUIUpdatesFromConfig(name string) bool {
	return ps.dashboardProvisioner.GetAllowUIUpdatesFromConfig(name)
}

func (ps *ProvisioningServiceImpl) cancelPolling() {
	if ps.pollingCtxCancel != nil {
		ps.log.Debug("Stop polling for dashboard changes")
		ps.pollingCtxCancel()
	}
	ps.pollingCtxCancel = nil
}
