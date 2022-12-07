import { cloneDeep } from 'lodash';
import { Observable, ReplaySubject, Unsubscribable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  compareArrayValues,
  compareDataFrameStructures,
  CoreApp,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  LoadingState,
  PanelData,
} from '@grafana/data';

import { runRequest } from './runRequest';

export interface QueryRunnerOptions<TQuery extends DataQuery = DataQuery> {
  queries: TQuery[];
  panelId?: number;
  /** @deprecate */
  dashboardId?: number;
  dashboardUID?: string;
  publicDashboardAccessToken?: string;
  timeInfo?: string; // String description of time range for display
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
  private lastRequest?: DataQueryRequest;

  constructor() {
    this.subject = new ReplaySubject(1);
  }

  /**
   * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
   */
  getData(): Observable<PanelData> {
    let structureRev = 1;
    let lastData: DataFrame[] = [];

    return this.subject.pipe(
      map((data: PanelData) => {
        if (!compareArrayValues(lastData, data.series, compareDataFrameStructures)) {
          structureRev++;
        }
        lastData = data.series;

        return { ...data, structureRev };
      })
    );
  }

  async run(options: QueryRunnerOptions) {
    const {
      queries,
      panelId,
      dashboardId,
      dashboardUID,
      timeInfo,
      cacheTimeout,
    } = options;

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: getNextRequestId(),
      panelId,
      dashboardId,
      dashboardUID,
      timeInfo,
      targets: cloneDeep(queries),
      cacheTimeout,
      startTime: Date.now(),
    };

    try {
      this.lastRequest = request;
      this.pipeToSubject(runRequest(request), panelId);
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
        this.lastResult = data;
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
