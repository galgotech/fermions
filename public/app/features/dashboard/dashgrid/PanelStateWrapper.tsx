import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import {
  CoreApp,
  DashboardCursorSync,
  EventFilterOptions,
  LoadingState,
  PanelData,
  PanelPlugin,
  PanelPluginMeta,
  PluginContextProvider,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  ErrorBoundary,
  PanelChrome,
  PanelContext,
  PanelContextProvider,
  PanelPadding,
} from '@grafana/ui';
import { PANEL_BORDER } from 'app/core/constants';
import { profiler } from 'app/core/profiler';
import { WorkflowEvent } from 'app/types/events';

import { DashboardModel, PanelModel } from '../state';

import { PanelHeader } from './PanelHeader/PanelHeader';
import { PanelHeaderLoadingIndicator } from './PanelHeader/PanelHeaderLoadingIndicator';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;
  width: number;
  height: number;
  onInstanceStateChange: (value: any) => void;
  timezone?: string;
  isPublic?: boolean;
}

export interface State {
  renderCounter: number;
  errorMessage?: string;
  refreshWhenInView: boolean;
  context: PanelContext;
  data: PanelData;
}

export class PanelStateWrapper extends PureComponent<Props, State> {
  private subs = new Subscription();
  private eventFilter: EventFilterOptions = { onlyLocal: true };

  constructor(props: Props) {
    super(props);

    // Can this eventBus be on PanelModel?  when we have more complex event filtering, that may be a better option
    const eventBus = props.dashboard.events.newScopedBus(`panel:${props.panel.id}`, this.eventFilter);

    this.state = {
      renderCounter: 0,
      refreshWhenInView: false,
      context: {
        eventBus,
        app: this.getPanelContextApp(),
        sync: this.getSync,
        onInstanceStateChange: this.onInstanceStateChange,
      },
      data: this.getInitialPanelDataState(),
    };
  }

  // Due to a mutable panel model we get the sync settings via function that proactively reads from the model
  getSync = () => DashboardCursorSync.Off;

  onInstanceStateChange = (value: any) => {
    this.props.onInstanceStateChange(value);

    this.setState({
      context: {
        ...this.state.context,
        instanceState: value,
      },
    });
  };

  getPanelContextApp() {
    if (this.props.isEditing) {
      return CoreApp.PanelEditor;
    }
    if (this.props.isViewing) {
      return CoreApp.PanelViewer;
    }

    return CoreApp.Dashboard;
  }

  getInitialPanelDataState(): PanelData {
    return {
      state: LoadingState.NotStarted,
    };
  }

  componentDidMount() {
    const { panel, dashboard } = this.props;

    // Subscribe to panel events
    this.subs.add(panel.events.subscribe(WorkflowEvent, this.onWorkflow));

    dashboard.panelInitialized(this.props.panel);

    this.subs.add(
      panel
        .getQueryRunner()
        .getData()
        .subscribe({
          next: (data) => this.onDataUpdate(data),
        })
    );
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  componentDidUpdate(prevProps: Props) {
    const { isInView } = this.props;
    const { context } = this.state;

    const app = this.getPanelContextApp();

    if (context.app !== app) {
      this.setState({
        context: {
          ...context,
          app,
        },
      });
    }

    // View state has changed
    if (isInView !== prevProps.isInView) {
      if (isInView) {
        // Check if we need a delayed refresh
        if (this.state.refreshWhenInView) {
          this.onWorkflow();
        }
      }
    }
  }

  // Updates the response with information from the stream
  // The next is outside a react synthetic event so setState is not batched
  // So in this context we can only do a single call to setState
  onDataUpdate(data: PanelData) {
    let errorMessage: string | undefined;

    switch (data.state) {
      case LoadingState.Loading:
        // Skip updating state data if it is already in loading state
        // This is to avoid rendering partial loading responses
        if (this.state.data.state === LoadingState.Loading) {
          return;
        }
        break;
      case LoadingState.Error:
        const { error } = data;
        if (error) {
          if (errorMessage !== error.message) {
            errorMessage = error.message;
          }
        }
        break;
      case LoadingState.Done:
        break;
    }

    this.setState({ errorMessage, data });
  }

  onWorkflow = () => {
    const { panel, isInView, width } = this.props;

    if (!isInView) {
      this.setState({ refreshWhenInView: true });
      return;
    }

    if (width < 0) {
      return;
    }

    if (this.state.refreshWhenInView) {
      this.setState({ refreshWhenInView: false });
    }

    panel.runWorkflow();
  };

  onOptionsChange = (options: any) => {
    this.props.panel.updateOptions(options);
  };

  onPanelError = (error: Error) => {
    const errorMessage = error.message || DEFAULT_PLUGIN_ERROR;
    if (this.state.errorMessage !== errorMessage) {
      this.setState({ errorMessage });
    }
  };

  onPanelErrorRecover = () => {
    this.setState({ errorMessage: undefined });
  };

  shouldSignalRenderingCompleted(loadingState: LoadingState, pluginMeta: PanelPluginMeta) {
    return loadingState === LoadingState.Done ;
  }

  renderPanelContent(innerWidth: number, innerHeight: number) {
    const { panel, plugin, dashboard } = this.props;
    const { renderCounter, data } = this.state;
    const { state: loadingState } = data;

    // This is only done to increase a counter that is used by backend
    // image rendering to know when to capture image
    if (this.shouldSignalRenderingCompleted(loadingState, plugin.meta)) {
      profiler.renderingCompleted();
    }

    const PanelComponent = plugin.panel!;
    const panelOptions = panel.getOptions();

    return (
      <>
        <PanelContextProvider value={this.state.context}>
          <PanelComponent
            id={panel.id}
            data={data}
            title={panel.title}
            options={panelOptions}
            width={innerWidth}
            height={innerHeight}
            renderCounter={renderCounter}
            onOptionsChange={this.onOptionsChange}
            eventBus={dashboard.events}
          />
        </PanelContextProvider>
      </>
    );
  }

  renderPanel(width: number, height: number) {
    const { panel, plugin, dashboard } = this.props;
    const { renderCounter, data } = this.state;
    const { theme } = config;
    const { state: loadingState } = data;

    // This is only done to increase a counter that is used by backend
    // image rendering to know when to capture image
    if (this.shouldSignalRenderingCompleted(loadingState, plugin.meta)) {
      profiler.renderingCompleted();
    }

    const PanelComponent = plugin.panel!;
    const headerHeight = theme.panelHeaderHeight;
    const chromePadding = 0;
    const panelWidth = width - chromePadding * 2 - PANEL_BORDER;
    const innerPanelHeight = height - headerHeight - chromePadding * 2 - PANEL_BORDER;
    const panelContentClassNames = classNames({
      'panel-content': true,
      'panel-content--no-padding': true,
    });
    const panelOptions = panel.getOptions();

    return (
      <>
        <div className={panelContentClassNames}>
          <PluginContextProvider meta={plugin.meta}>
            <PanelContextProvider value={this.state.context}>
              <PanelComponent
                id={panel.id}
                data={data}
                title={panel.title}
                options={panelOptions}
                width={panelWidth}
                height={innerPanelHeight}
                renderCounter={renderCounter}
                onOptionsChange={this.onOptionsChange}
                eventBus={dashboard.events}
              />
            </PanelContextProvider>
          </PluginContextProvider>
        </div>
      </>
    );
  }

  render() {
    const { dashboard, panel, isViewing, isEditing, width, height, plugin, isPublic } = this.props;
    const { errorMessage, data } = this.state;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--transparent': isPublic,
    });

    // for new panel header design
    const onCancelQuery = () => panel.getQueryRunner().cancelQuery();
    const noPadding: PanelPadding = 'none';
    const leftItems = [
      <PanelHeaderLoadingIndicator state={data.state} onClick={onCancelQuery} key="loading-indicator" />,
    ];

    if (config.featureToggles.newPanelChromeUI) {
      return (
        <PanelChrome width={width} height={height} title={panel.title} leftItems={leftItems} padding={noPadding}>
          {(innerWidth, innerHeight) => (
            <>
              <ErrorBoundary
                dependencies={[data, plugin, panel.getOptions()]}
                onError={this.onPanelError}
                onRecover={this.onPanelErrorRecover}
              >
                {({ error }) => {
                  if (error) {
                    return null;
                  }
                  return this.renderPanelContent(innerWidth, innerHeight);
                }}
              </ErrorBoundary>
            </>
          )}
        </PanelChrome>
      );
    } else {
      return (
        <section
          className={containerClassNames}
          aria-label={selectors.components.Panels.Panel.containerByTitle(panel.title)}
        >
          {!isPublic && <PanelHeader
            panel={panel}
            dashboard={dashboard}
            title={panel.title}
            description={panel.description}
            error={errorMessage}
            isEditing={isEditing}
            isViewing={isViewing}
            data={data}
          />}
          <ErrorBoundary
            dependencies={[data, plugin, panel.getOptions()]}
            onError={this.onPanelError}
            onRecover={this.onPanelErrorRecover}
          >
            {({ error }) => {
              if (error) {
                return null;
              }
              return this.renderPanel(width, height);
            }}
          </ErrorBoundary>
        </section>
      );
    }
  }
}
