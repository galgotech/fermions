import { asyncScheduler, Observable, of, scheduled } from 'rxjs';

import { getDefaultTimeRange } from '@grafana/data';

import { DashboardQueryRunnerOptions } from './types';

// function that creates an async of result Observable
export function toAsyncOfResult(result: any): Observable<any> {
  return scheduled(of(result), asyncScheduler);
}

export const LEGACY_DS_NAME = 'Legacy';
export const NEXT_GEN_DS_NAME = 'NextGen';

function getAnnotation({
  enable = true,
  datasource = LEGACY_DS_NAME,
}: { enable?: boolean; datasource?: string } = {}) {
  const annotation = {
    id: undefined,
    enable,
    hide: false,
    name: 'Test',
    iconColor: 'pink',
    datasource,
  };

  return {
    ...annotation,
  };
}

export function getDefaultOptions(): DashboardQueryRunnerOptions {
  const legacy = getAnnotation({ datasource: LEGACY_DS_NAME });
  const nextGen = getAnnotation({ datasource: NEXT_GEN_DS_NAME });
  const dashboard: any = {
    id: 1,
    annotations: {
      list: [
        legacy,
        nextGen,
        getAnnotation({ enable: false }),
        getAnnotation({ }),
        getAnnotation({ enable: false }),
      ],
    },
    events: {
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      publish: jest.fn(),
    },
    panels: [{ alert: {} } as any],
    meta: {
      publicDashboardAccessToken: '',
    },
  };
  const range = getDefaultTimeRange();

  return { dashboard, range };
}
