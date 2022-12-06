import { DataQuery } from '@grafana/data';
import { LiveDataFilter } from '@grafana/runtime';
import { SearchQuery } from 'app/features/search/service';

//----------------------------------------------
// Query
//----------------------------------------------

export enum GrafanaQueryType {
  LiveMeasurements = 'measurements',

  // backend
  RandomWalk = 'randomWalk',
  List = 'list',
  Read = 'read',
  Search = 'search',
}

export interface GrafanaQuery extends DataQuery {
  queryType: GrafanaQueryType; // RandomWalk by default
  channel?: string;
  filter?: LiveDataFilter;
  buffer?: number;
  path?: string; // for list and read
  search?: SearchQuery;
}

export const defaultQuery: GrafanaQuery = {
  refId: 'A',
  queryType: GrafanaQueryType.RandomWalk,
};
