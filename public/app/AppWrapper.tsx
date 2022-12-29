import { Action, KBarProvider } from 'kbar';
import React from 'react';
import { Provider } from 'react-redux';
import { Router, Route, Redirect, Switch } from 'react-router-dom';

import { config, locationService, navigationLogger, reportInteraction } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { SearchWrapper } from 'app/features/search';
import { getAppRoutes } from 'app/routes/routes';
import { store } from 'app/store/store';

import { GrafanaApp } from './app';
import { AppChrome } from './core/components/AppChrome/AppChrome';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { NavBar } from './core/components/NavBar/NavBar';
import { GrafanaContext } from './core/context/GrafanaContext';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { RouteDescriptor } from './core/navigation/types';
import { contextSrv } from './core/services/context_srv';
import { ThemeProvider } from './core/utils/ConfigProvider';
import { CommandPalette } from './features/commandPalette/CommandPalette';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';

interface AppWrapperProps {
  app: GrafanaApp;
}

interface AppWrapperState {
  ready?: boolean;
}

export class AppWrapper extends React.Component<AppWrapperProps, AppWrapperState> {
  constructor(props: AppWrapperProps) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    this.setState({ ready: true });
    $('.preloader').remove();
  }

  renderRoute = (route: RouteDescriptor) => {
    const roles = route.roles ? route.roles() : [];

    return (
      <Route
        exact={route.exact === undefined ? true : route.exact}
        path={route.path}
        key={route.path}
        render={(props) => {
          navigationLogger('AppWrapper', false, 'Rendering route', route, 'with match', props.location);
          // TODO[Router]: test this logic
          if (roles?.length) {
            if (!roles.some((r: string) => contextSrv.hasRole(r))) {
              return <Redirect to="/" />;
            }
          }

          return <GrafanaRoute {...props} route={route} />;
        }}
      />
    );
  };

  renderRoutes() {
    return <Switch>{getAppRoutes().map((r) => this.renderRoute(r))}</Switch>;
  }

  renderNavBar() {
    if (!this.state.ready || config.featureToggles.topnav) {
      return null;
    }

    return <NavBar />;
  }

  commandPaletteEnabled() {
    return config.featureToggles.commandPalette;
  }

  searchBarEnabled() {
    return true;
  }

  render() {
    const { app } = this.props;
    const { ready } = this.state;

    navigationLogger('AppWrapper', false, 'rendering');

    const commandPaletteActionSelected = (action: Action) => {
      reportInteraction('command_palette_action_selected', {
        actionId: action.id,
        actionName: action.name,
      });
    };

    return (
      <React.StrictMode>
        <Provider store={store}>
          <ErrorBoundaryAlert style="page">
            <GrafanaContext.Provider value={app.context}>
              <ThemeProvider value={config.theme2}>
                <KBarProvider
                  actions={[]}
                  options={{ enableHistory: true, callbacks: { onSelectAction: commandPaletteActionSelected } }}
                >
                  <ModalsProvider>
                    <GlobalStyles />
                    {this.commandPaletteEnabled() && <CommandPalette />}
                    <div className="grafana-app">
                      <Router history={locationService.getHistory()}>
                        {config.isPublicDashboardView && (<>
                          {ready && this.renderRoutes()}
                        </>)}
                        {!config.isPublicDashboardView && (<>
                          {this.renderNavBar()}
                          <AppChrome>
                            <AppNotificationList />
                            {this.searchBarEnabled() && <SearchWrapper />}
                            {ready && this.renderRoutes()}
                          </AppChrome>
                        </>)}
                      </Router>
                    </div>
                    <LiveConnectionWarning />
                    <ModalRoot />
                    <PortalContainer />
                  </ModalsProvider>
                </KBarProvider>
              </ThemeProvider>
            </GrafanaContext.Provider>
          </ErrorBoundaryAlert>
        </Provider>
      </React.StrictMode>
    );
  }
}
