package process

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type Manager struct {
	pluginRegistry registry.Service

	mu  sync.Mutex
	log log.Logger
}

func ProvideService(pluginRegistry registry.Service) *Manager {
	return NewManager(pluginRegistry)
}

func NewManager(pluginRegistry registry.Service) *Manager {
	return &Manager{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugin.process.manager"),
	}
}

func (m *Manager) Run(ctx context.Context) error {
	<-ctx.Done()
	m.shutdown(ctx)
	return ctx.Err()
}

// shutdown stops all backend plugin processes
func (m *Manager) shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		wg.Add(1)
		go func(p backendplugin.Plugin, ctx context.Context) {
			defer wg.Done()
			p.Logger().Debug("Stopping plugin")
			if err := p.Stop(ctx); err != nil {
				p.Logger().Error("Failed to stop plugin", "error", err)
			}
			p.Logger().Debug("Plugin stopped")
		}(p, ctx)
	}
	wg.Wait()
}
