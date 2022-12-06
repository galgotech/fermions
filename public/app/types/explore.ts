import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  LogsModel,
  PanelData,
  QueryHint,
} from '@grafana/data';

export enum ExploreId {
  left = 'left',
  right = 'right',
}

export type ExploreQueryParams = {
  left: string;
  right: string;
};

export const EXPLORE_GRAPH_STYLES = ['lines', 'bars', 'points', 'stacked_lines', 'stacked_bars'] as const;
export type ExploreGraphStyle = typeof EXPLORE_GRAPH_STYLES[number];

export interface ExploreUpdateState {
  datasource: boolean;
  queries: boolean;
  range: boolean;
  mode: boolean;
}

export interface QueryOptions {
  minInterval?: string;
  maxDataPoints?: number;
  liveStreaming?: boolean;
}

export interface QueryTransaction {
  id: string;
  done: boolean;
  error?: string | JSX.Element;
  hints?: QueryHint[];
  request: DataQueryRequest;
  queries: DataQuery[];
  result?: any; // Table model / Timeseries[] / Logs
  scanning?: boolean;
}

export type RichHistoryQuery<T extends DataQuery = DataQuery> = {
  id: string;
  createdAt: number;
  datasourceUid: string;
  datasourceName: string;
  starred: boolean;
  comment: string;
  queries: T[];
};

export interface ExplorePanelData extends PanelData {
  graphFrames: DataFrame[];
  tableFrames: DataFrame[];
  logsFrames: DataFrame[];
  traceFrames: DataFrame[];
  nodeGraphFrames: DataFrame[];
  flameGraphFrames: DataFrame[];
  graphResult: DataFrame[] | null;
  tableResult: DataFrame[] | null;
  logsResult: LogsModel | null;
}
