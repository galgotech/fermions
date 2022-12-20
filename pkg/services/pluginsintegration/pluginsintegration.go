package pluginsintegration

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/plugins/repo"
)

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	config.ProvideConfig,
	store.ProvideService,
	wire.Bind(new(plugins.Store), new(*store.Service)),
	wire.Bind(new(plugins.SecretsPluginManager), new(*store.Service)),
	wire.Bind(new(plugins.StaticRouteResolver), new(*store.Service)),
	loader.ProvideService,
	wire.Bind(new(loader.Service), new(*loader.Loader)),
	wire.Bind(new(plugins.ErrorResolver), new(*loader.Loader)),
	manager.ProvideInstaller,
	wire.Bind(new(plugins.Installer), new(*manager.PluginInstaller)),
	registry.ProvideService,
	wire.Bind(new(registry.Service), new(*registry.InMemory)),
	repo.ProvideService,
	wire.Bind(new(repo.Service), new(*repo.Manager)),
	plugincontext.ProvideService,
)

// WireExtensionSet provides a wire.ProviderSet of plugin providers that can be
// extended.
var WireExtensionSet = wire.NewSet(
	signature.ProvideOSSAuthorizer,
	wire.Bind(new(plugins.PluginLoaderAuthorizer), new(*signature.UnsignedPluginAuthorizer)),
)
