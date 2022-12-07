import { Unsubscribable } from 'rxjs';

import {
  DataFrame,
  DataQueryResponse,
  DataSourceApi,
  LegacyResponseData,
  LoadingState,
  PanelData,
  PanelEvents,
  TimeRange,
  toLegacyResponseData,
} from '@grafana/data';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import { ContextSrv } from 'app/core/services/context_srv';
import { PanelModel } from 'app/features/dashboard/state';

import { PanelQueryRunner } from '../../features/query/state/PanelQueryRunner';

class MetricsPanelCtrl extends PanelCtrl {
  declare datasource: DataSourceApi;
  declare range: TimeRange;

  contextSrv: ContextSrv;
  datasourceSrv: any;
  timeSrv: any;
  templateSrv: any;
  interval: any;
  intervalMs: any;
  resolution: any;
  timeInfo?: string;
  skipDataOnInit = false;
  dataList: LegacyResponseData[] = [];
  querySubscription?: Unsubscribable | null;
  useDataFrames = false;
  panelData?: PanelData;

  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    this.contextSrv = $injector.get('contextSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.timeSrv = $injector.get('timeSrv');
    this.templateSrv = $injector.get('templateSrv');
    this.panel.datasource = this.panel.datasource || null;

    this.events.on(PanelEvents.refresh, this.onMetricsPanelRefresh.bind(this));
    this.events.on(PanelEvents.panelTeardown, this.onPanelTearDown.bind(this));
    this.events.on(PanelEvents.componentDidMount, this.onMetricsPanelMounted.bind(this));
  }

  private onMetricsPanelMounted() {
    const queryRunner = this.panel.getQueryRunner() as PanelQueryRunner;
    this.querySubscription = queryRunner
      .getData()
      .subscribe(this.panelDataObserver);
  }

  private onPanelTearDown() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  private onMetricsPanelRefresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) {
      return;
    }

    // clear loading/error state
    delete this.error;
    this.loading = true;

    // load datasource service
    return this.datasourceSrv
      .get(this.panel.datasource)
      .then(this.issueQueries.bind(this))
      .catch((err: any) => {
        this.processDataError(err);
      });
  }

  processDataError(err: any) {
    // if canceled  keep loading set to true
    if (err.cancelled) {
      console.log('Panel request cancelled', err);
      return;
    }

    this.error = err.message || 'Request Error';

    if (err.data) {
      if (err.data.message) {
        this.error = err.data.message;
      } else if (err.data.error) {
        this.error = err.data.error;
      }
    }

    this.angularDirtyCheck();
  }

  angularDirtyCheck() {
    if (!this.$scope.$root.$$phase) {
      this.$scope.$digest();
    }
  }

  // Updates the response with information from the stream
  panelDataObserver = {
    next: (data: PanelData) => {
      this.panelData = data;

      if (data.state === LoadingState.Error) {
        this.loading = false;
        this.processDataError(data.error);
      }

      // Ignore data in loading state
      if (data.state === LoadingState.Loading) {
        this.loading = true;
        this.angularDirtyCheck();
        return;
      }

      if (data.request) {
        const { timeInfo } = data.request;
        if (timeInfo) {
          this.timeInfo = timeInfo;
        }
      }

      if (this.useDataFrames) {
        this.handleDataFrames(data.series);
      } else {
        // Make the results look as if they came directly from a <6.2 datasource request
        const legacy = data.series.map((v) => toLegacyResponseData(v));
        this.handleQueryResult({ data: legacy });
      }

      this.angularDirtyCheck();
    },
  };

  issueQueries(datasource: DataSourceApi) {
    this.datasource = datasource;

    const panel = this.panel as PanelModel;
    const queryRunner = panel.getQueryRunner();

    return queryRunner.run({
      datasource: panel.datasource,
      queries: panel.targets,
      panelId: panel.id,
      dashboardId: this.dashboard.id,
      timeInfo: this.timeInfo,
      publicDashboardAccessToken: this.dashboard.meta.publicDashboardAccessToken,
      cacheTimeout: panel.cacheTimeout,
    });
  }

  handleDataFrames(data: DataFrame[]) {
    this.loading = false;

    try {
      this.events.emit(PanelEvents.dataFramesReceived, data);
    } catch (err) {
      this.processDataError(err);
    }
  }

  handleQueryResult(result: DataQueryResponse) {
    this.loading = false;

    if (!result || !result.data) {
      console.log('Data source query result invalid, missing data field:', result);
      result = { data: [] };
    }

    try {
      this.events.emit(PanelEvents.dataReceived, result.data);
    } catch (err) {
      this.processDataError(err);
    }
  }
}

export { MetricsPanelCtrl };
