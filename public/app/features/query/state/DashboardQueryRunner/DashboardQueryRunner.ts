import { merge, Observable, ReplaySubject, Subject, Subscription, timer, Unsubscribable } from 'rxjs';
import { finalize, map, mapTo, mergeAll, share, takeUntil } from 'rxjs/operators';

import { RefreshEvent } from '@grafana/runtime';

import { getTimeSrv, TimeSrv } from '../../../dashboard/services/TimeSrv';
import { DashboardModel } from '../../../dashboard/state';

import {
  DashboardQueryRunner,
  DashboardQueryRunnerOptions,
  DashboardQueryRunnerResult,
  DashboardQueryRunnerWorker,
  DashboardQueryRunnerWorkerResult,
} from './types';

class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: ReplaySubject<DashboardQueryRunnerWorkerResult>;
  private readonly runs: Subject<DashboardQueryRunnerOptions>;
  private readonly runsSubscription: Unsubscribable;
  private readonly eventsSubscription: Unsubscribable;

  constructor(
    private readonly dashboard: DashboardModel,
    private readonly timeSrv: TimeSrv = getTimeSrv(),
    private readonly workers: DashboardQueryRunnerWorker[] = []
  ) {
    this.run = this.run.bind(this);
    this.getResult = this.getResult.bind(this);
    this.destroy = this.destroy.bind(this);
    this.executeRun = this.executeRun.bind(this);
    this.results = new ReplaySubject<DashboardQueryRunnerWorkerResult>(1);
    this.runs = new Subject<DashboardQueryRunnerOptions>();
    this.runsSubscription = this.runs.subscribe((options) => this.executeRun(options));
    this.eventsSubscription = dashboard.events.subscribe(RefreshEvent, (event) => {
      this.run({ dashboard: this.dashboard, range: this.timeSrv.timeRange() });
    });
  }

  run(options: DashboardQueryRunnerOptions): void {
    this.runs.next(options);
  }

  getResult(panelId?: number): Observable<DashboardQueryRunnerResult> {
    return this.results.asObservable().pipe(
      map((result) => {
        return {};
      })
    );
  }

  private executeRun(options: DashboardQueryRunnerOptions) {
    const workers = this.workers.filter((w) => w.canWork(options));
    const workerObservables = workers.map((w) => w.work(options));

    const resultSubscription = new Subscription();
    const resultObservable = merge(workerObservables).pipe(
      takeUntil(this.runs.asObservable()),
      mergeAll(),
      finalize(() => {
        resultSubscription.unsubscribe(); // important to avoid memory leaks
      }),
      share() // shared because we're using it in takeUntil below
    );

    const timerSubscription = new Subscription();
    const timerObservable = timer(200).pipe(
      mapTo({ }),
      takeUntil(resultObservable),
      finalize(() => {
        timerSubscription.unsubscribe(); // important to avoid memory leaks
      })
    );

    // if the result takes longer than 200ms we just publish an empty result
    timerSubscription.add(
      timerObservable.subscribe((result) => {
        this.results.next(result);
      })
    );

    resultSubscription.add(
      resultObservable.subscribe((result: DashboardQueryRunnerWorkerResult) => {
        this.results.next(result);
      })
    );
  }

  destroy(): void {
    this.results.complete();
    this.runs.complete();
    this.runsSubscription.unsubscribe();
    this.eventsSubscription.unsubscribe();
  }
}

let dashboardQueryRunner: DashboardQueryRunner | undefined;

function setDashboardQueryRunner(runner: DashboardQueryRunner): void {
  if (dashboardQueryRunner) {
    dashboardQueryRunner.destroy();
  }
  dashboardQueryRunner = runner;
}

export function getDashboardQueryRunner(): DashboardQueryRunner {
  if (!dashboardQueryRunner) {
    throw new Error('getDashboardQueryRunner can only be used after Grafana instance has started.');
  }
  return dashboardQueryRunner;
}

export interface DashboardQueryRunnerFactoryArgs {
  dashboard: DashboardModel;
  timeSrv?: TimeSrv;
  workers?: DashboardQueryRunnerWorker[];
}

export type DashboardQueryRunnerFactory = (args: DashboardQueryRunnerFactoryArgs) => DashboardQueryRunner;

let factory: DashboardQueryRunnerFactory | undefined;

export function setDashboardQueryRunnerFactory(instance: DashboardQueryRunnerFactory) {
  factory = instance;
}

export function createDashboardQueryRunner(args: DashboardQueryRunnerFactoryArgs): DashboardQueryRunner {
  if (!factory) {
    factory = ({ dashboard, timeSrv, workers }: DashboardQueryRunnerFactoryArgs) =>
      new DashboardQueryRunnerImpl(dashboard, timeSrv, workers);
  }

  const runner = factory(args);
  setDashboardQueryRunner(runner);
  return runner;
}
