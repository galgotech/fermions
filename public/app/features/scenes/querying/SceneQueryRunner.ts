import { cloneDeep } from 'lodash';
import { Unsubscribable } from 'rxjs';

import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceRef,
  PanelData,
  TimeRange,
} from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';
import { runRequest } from 'app/features/query/state/runRequest';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { sceneGraph } from '../core/sceneGraph';
import { SceneObjectStatePlain } from '../core/types';

export interface QueryRunnerState extends SceneObjectStatePlain {
  data?: PanelData;
  queries: DataQueryExtended[];
  datasource?: DataSourceRef;
  minInterval?: string;
  maxDataPoints?: number;
  // Non persisted state
  maxDataPointsFromWidth?: boolean;
}

export interface DataQueryExtended extends DataQuery {
  [key: string]: any;
}

export class SceneQueryRunner extends SceneObjectBase<QueryRunnerState> {
  private _querySub?: Unsubscribable;
  private _containerWidth?: number;

  public activate() {
    super.activate();

    const timeRange = sceneGraph.getTimeRange(this);

    this._subs.add(
      timeRange.subscribeToState({
        next: (timeRange) => {
          this.runWithTimeRange(timeRange.value);
        },
      })
    );

    if (this.shouldRunQueriesOnActivate()) {
      this.runQueries();
    }
  }

  private shouldRunQueriesOnActivate() {
    // If we already have data, no need
    // TODO validate that time range is similar and if not we should run queries again
    if (this.state.data) {
      return false;
    }

    // If no maxDataPoints specified we need might to wait for container width to be set from the outside
    if (!this.state.maxDataPoints && this.state.maxDataPointsFromWidth && !this._containerWidth) {
      return false;
    }

    return true;
  }

  public deactivate(): void {
    super.deactivate();

    if (this._querySub) {
      this._querySub.unsubscribe();
      this._querySub = undefined;
    }
  }

  public setContainerWidth(width: number) {
    // If we don't have a width we should run queries
    if (!this._containerWidth && width > 0) {
      this._containerWidth = width;

      // If we don't have maxDataPoints specifically set and maxDataPointsFromWidth is true
      if (this.state.maxDataPointsFromWidth && !this.state.maxDataPoints) {
        // As this is called from render path we need to wait for next tick before running queries
        setTimeout(() => {
          if (this.isActive && !this._querySub) {
            this.runQueries();
          }
        }, 0);
      }
    } else {
      // let's just remember the width until next query issue
      this._containerWidth = width;
    }
  }

  public runQueries() {
    const timeRange = sceneGraph.getTimeRange(this);
    this.runWithTimeRange(timeRange.state.value);
  }

  private async runWithTimeRange(timeRange: TimeRange) {
    const { datasource, queries } = this.state;

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: getNextRequestId(),
      panelId: 1,
      dashboardId: 1,
      targets: cloneDeep(queries),
      startTime: Date.now(),
    };

    try {
      const ds = await getDataSource(datasource);

      // Attach the data source name to each query
      request.targets = request.targets.map((query) => {
        if (!query.datasource) {
          query.datasource = ds.getRef();
        }
        return query;
      });

      this._querySub = runRequest(ds, request).subscribe({
        next: this.onDataReceived,
      });
    } catch (err) {
      console.error('PanelQueryRunner Error', err);
    }
  }

  private onDataReceived = (data: PanelData) => {
    this.setState({ data });
  };
}

async function getDataSource(datasource: DataSourceRef | undefined): Promise<DataSourceApi> {
  if (datasource && (datasource as any).query) {
    return datasource as DataSourceApi;
  }
  return await getDatasourceSrv().get(datasource as string);
}
