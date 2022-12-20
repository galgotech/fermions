package plugins

import (
	"context"
)

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, pluginID string) (PluginDTO, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...Type) []PluginDTO
}

type Installer interface {
	// Add adds a new plugin.
	Add(ctx context.Context, pluginID, version string, opts CompatOpts) error
	// Remove removes an existing plugin.
	Remove(ctx context.Context, pluginID string) error
}

type PluginSource struct {
	Class Class
	Paths []string
}

type CompatOpts struct {
	GrafanaVersion string
	OS             string
	Arch           string
}

type UpdateInfo struct {
	PluginZipURL string
}

type SecretsPluginManager interface {
	// SecretsManager returns a secretsmanager plugin
	SecretsManager(ctx context.Context) *Plugin
}

type StaticRouteResolver interface {
	Routes() []*StaticRoute
}

type ErrorResolver interface {
	PluginErrors() []*Error
}

type PluginLoaderAuthorizer interface {
	// CanLoadPlugin confirms if a plugin is authorized to load
	CanLoadPlugin(plugin *Plugin) bool
}

// RoleRegistry handles the plugin RBAC roles and their assignments
type RoleRegistry interface {
	DeclarePluginRoles(ctx context.Context, ID, name string, registrations []RoleRegistration) error
}
