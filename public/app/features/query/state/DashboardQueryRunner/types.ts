import { Observable } from 'rxjs';

import { TimeRange } from '@grafana/data';

import { DashboardModel } from '../../../dashboard/state';

export interface DashboardQueryRunnerOptions {
  dashboard: DashboardModel;
  range: TimeRange;
}

export interface DashboardQueryRunnerResult {}

export interface DashboardQueryRunner {
  run: (options: DashboardQueryRunnerOptions) => void;
  getResult: (panelId?: number) => Observable<DashboardQueryRunnerResult>;
  destroy: () => void;
}

export interface DashboardQueryRunnerWorkerResult { }

export interface DashboardQueryRunnerWorker {
  canWork: (options: DashboardQueryRunnerOptions) => boolean;
  work: (options: DashboardQueryRunnerOptions) => Observable<DashboardQueryRunnerWorkerResult>;
}
