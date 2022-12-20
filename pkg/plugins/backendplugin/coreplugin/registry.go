package coreplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdklog "github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

const (
	Grafana = "grafana"
)

func init() {
	// Non-optimal global solution to replace plugin SDK default loggers for core plugins.
	sdklog.DefaultLogger = &logWrapper{logger: log.New("plugin.coreplugin")}
	backend.Logger = sdklog.DefaultLogger
}

type Registry struct {
	store map[string]backendplugin.PluginFactoryFunc
}

func NewRegistry(store map[string]backendplugin.PluginFactoryFunc) *Registry {
	return &Registry{
		store: store,
	}
}

func ProvideCoreRegistry() *Registry {
	return NewRegistry(map[string]backendplugin.PluginFactoryFunc{})
}

func (cr *Registry) Get(pluginID string) backendplugin.PluginFactoryFunc {
	return cr.store[pluginID]
}

func (cr *Registry) BackendFactoryProvider() func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
		if !p.IsCorePlugin() {
			return nil
		}

		return cr.Get(p.ID)
	}
}

func asBackendPlugin(svc interface{}) backendplugin.PluginFactoryFunc {
	opts := backend.ServeOpts{}
	if queryHandler, ok := svc.(backend.QueryDataHandler); ok {
		opts.QueryDataHandler = queryHandler
	}
	if resourceHandler, ok := svc.(backend.CallResourceHandler); ok {
		opts.CallResourceHandler = resourceHandler
	}
	if streamHandler, ok := svc.(backend.StreamHandler); ok {
		opts.StreamHandler = streamHandler
	}
	if healthHandler, ok := svc.(backend.CheckHealthHandler); ok {
		opts.CheckHealthHandler = healthHandler
	}

	if opts.QueryDataHandler != nil || opts.CallResourceHandler != nil ||
		opts.CheckHealthHandler != nil || opts.StreamHandler != nil {
		return New(opts)
	}

	return nil
}

type logWrapper struct {
	logger log.Logger
}

func (l *logWrapper) Debug(msg string, args ...interface{}) {
	l.logger.Debug(msg, args...)
}

func (l *logWrapper) Info(msg string, args ...interface{}) {
	l.logger.Info(msg, args...)
}

func (l *logWrapper) Warn(msg string, args ...interface{}) {
	l.logger.Warn(msg, args...)
}

func (l *logWrapper) Error(msg string, args ...interface{}) {
	l.logger.Error(msg, args...)
}

func (l *logWrapper) Level() sdklog.Level {
	return sdklog.NoLevel
}
