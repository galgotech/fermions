import { DataFrame, DataQuery, DataQueryError, DataTopic } from '@grafana/data';

export interface DashboardQuery extends DataQuery {
  panelId?: number;
  topic?: DataTopic;
}

export type ResultInfo = {
  img: string; // The Datasource
  refId: string;
  query: string; // As text
  data: DataFrame[];
  error?: DataQueryError;
};
