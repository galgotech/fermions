import { DataQuery } from '@grafana/data';

export interface QueryGroupOptions {
  queries: DataQuery[];
  savedQueryUid?: string | null;
  maxDataPoints?: number | null;
  minInterval?: string | null;
  cacheTimeout?: string | null;
  timeRange?: {
    from?: string | null;
    shift?: string | null;
    hide?: boolean;
  };
}
