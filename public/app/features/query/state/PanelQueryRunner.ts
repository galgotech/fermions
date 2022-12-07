import { cloneDeep } from 'lodash';
import { Observable, ReplaySubject, Unsubscribable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  applyFieldOverrides,
  compareArrayValues,
  compareDataFrameStructures,
  CoreApp,
  DataConfigSource,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  LoadingState,
  PanelData,
  ScopedVars,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { StreamingDataFrame } from 'app/features/live/data/StreamingDataFrame';
import { isStreamingDataFrame } from 'app/features/live/data/utils';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { isSharedDashboardQuery, runSharedRequest } from '../../../plugins/datasource/dashboard';
import { PublicDashboardDataSource } from '../../dashboard/services/PublicDashboardDataSource';

import { preProcessPanelData, runRequest } from './runRequest';

export interface QueryRunnerOptions<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: DataSourceRef | DataSourceApi<TQuery, TOptions> | null;
  queries: TQuery[];
  panelId?: number;
  /** @deprecate */
  dashboardId?: number;
  dashboardUID?: string;
  publicDashboardAccessToken?: string;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string | null;
}

let counter = 100;

export function getNextRequestId() {
  return 'Q' + counter++;
}

export class PanelQueryRunner {
  private subject: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;
  private lastResult?: PanelData;
  private dataConfigSource: DataConfigSource;
  private lastRequest?: DataQueryRequest;

  constructor(dataConfigSource: DataConfigSource) {
    this.subject = new ReplaySubject(1);
    this.dataConfigSource = dataConfigSource;
  }

  /**
   * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
   */
  getData(): Observable<PanelData> {
    let structureRev = 1;
    let lastData: DataFrame[] = [];
    let isFirstPacket = true;
    let lastConfigRev = -1;

    return this.subject.pipe(
      map((data: PanelData) => {
        let processedData = data;
        let streamingPacketWithSameSchema = false;

        if (data.series?.length) {
          if (lastConfigRev === this.dataConfigSource.configRev) {
            const streamingDataFrame = data.series.find((data) => isStreamingDataFrame(data)) as
              | StreamingDataFrame
              | undefined;

            if (
              streamingDataFrame &&
              !streamingDataFrame.packetInfo.schemaChanged &&
              // TODO: remove the condition below after fixing
              // https://github.com/grafana/grafana/pull/41492#issuecomment-970281430
              lastData[0].fields.length === streamingDataFrame.fields.length
            ) {
              processedData = {
                ...processedData,
                series: lastData.map((frame, frameIndex) => ({
                  ...frame,
                  length: data.series[frameIndex].length,
                  fields: frame.fields.map((field, fieldIndex) => ({
                    ...field,
                    values: data.series[frameIndex].fields[fieldIndex].values,
                    state: {
                      ...field.state,
                      calcs: undefined,
                      range: undefined,
                    },
                  })),
                })),
              };

              streamingPacketWithSameSchema = true;
            }
          }

          // Apply field defaults and overrides
          let fieldConfig = this.dataConfigSource.getFieldOverrideOptions();

          if (fieldConfig != null && (isFirstPacket || !streamingPacketWithSameSchema)) {
            lastConfigRev = this.dataConfigSource.configRev!;
            processedData = {
              ...processedData,
              series: applyFieldOverrides({
                data: processedData.series,
                ...fieldConfig!,
              }),
            };
            isFirstPacket = false;
          }
        }

        if (
          !streamingPacketWithSameSchema &&
          !compareArrayValues(lastData, processedData.series, compareDataFrameStructures)
        ) {
          structureRev++;
        }
        lastData = processedData.series;

        return { ...processedData, structureRev };
      })
    );
  }

  async run(options: QueryRunnerOptions) {
    const {
      queries,
      datasource,
      panelId,
      dashboardId,
      dashboardUID,
      publicDashboardAccessToken,
      timeRange,
      timeInfo,
      cacheTimeout,
    } = options;

    if (isSharedDashboardQuery(datasource)) {
      this.pipeToSubject(runSharedRequest(options, queries[0]), panelId);
      return;
    }

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: getNextRequestId(),
      panelId,
      dashboardId,
      dashboardUID,
      publicDashboardAccessToken,
      timeInfo,
      targets: cloneDeep(queries),
      cacheTimeout,
      startTime: Date.now(),
    };

    // Add deprecated property
    (request as any).rangeRaw = timeRange.raw;

    try {
      const ds = await getDataSource(datasource, publicDashboardAccessToken);
      const isMixedDS = ds.meta?.mixed;

      // Attach the data source to each query
      request.targets = request.targets.map((query) => {
        const isExpressionQuery = query.datasource?.type === ExpressionDatasourceRef.type;
        // When using a data source variable, the panel might have the incorrect datasource
        // stored, so when running the query make sure it is done with the correct one
        if (!query.datasource || (query.datasource.uid !== ds.uid && !isMixedDS && !isExpressionQuery)) {
          query.datasource = ds.getRef();
        }
        return query;
      });

      this.lastRequest = request;

      this.pipeToSubject(runRequest(ds, request), panelId);
    } catch (err) {
      console.error('PanelQueryRunner Error', err);
    }
  }

  private pipeToSubject(observable: Observable<PanelData>, panelId?: number) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    let panelData = observable;

    this.subscription = panelData.subscribe({
      next: (data) => {
        this.lastResult = preProcessPanelData(data, this.lastResult);
        // Store preprocessed query results for applying overrides later on in the pipeline
        this.subject.next(this.lastResult);
      },
    });
  }

  cancelQuery() {
    if (!this.subscription) {
      return;
    }

    this.subscription.unsubscribe();

    // If we have an old result with loading state, send it with done state
    if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
      this.subject.next({
        ...this.lastResult,
        state: LoadingState.Done,
      });
    }
  }

  resendLastResult = () => {
    if (this.lastResult) {
      this.subject.next(this.lastResult);
    }
  };

  clearLastResult() {
    this.lastResult = undefined;
    // A new subject is also needed since it's a replay subject that remembers/sends last value
    this.subject = new ReplaySubject(1);
  }

  /**
   * Called when the panel is closed
   */
  destroy() {
    // Tell anyone listening that we are done
    if (this.subject) {
      this.subject.complete();
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  useLastResultFrom(runner: PanelQueryRunner) {
    this.lastResult = runner.getLastResult();

    if (this.lastResult) {
      // The subject is a replay subject so anyone subscribing will get this last result
      this.subject.next(this.lastResult);
    }
  }

  /** Useful from tests */
  setLastResult(data: PanelData) {
    this.lastResult = data;
  }

  getLastResult(): PanelData | undefined {
    return this.lastResult;
  }

  getLastRequest(): DataQueryRequest | undefined {
    return this.lastRequest;
  }
}

async function getDataSource(
  datasource: DataSourceRef | string | DataSourceApi | null,
  publicDashboardAccessToken?: string
): Promise<DataSourceApi> {
  if (!publicDashboardAccessToken && datasource && typeof datasource === 'object' && 'query' in datasource) {
    return datasource;
  }

  const ds = await getDatasourceSrv().get(datasource);
  if (publicDashboardAccessToken) {
    return new PublicDashboardDataSource(ds);
  }

  return ds;
}
