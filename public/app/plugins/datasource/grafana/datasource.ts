import { merge, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  isValidLiveChannelAddress,
  MutableDataFrame,
  parseLiveChannelAddress,
} from '@grafana/data';
import {
  DataSourceWithBackend,
  getDataSourceSrv,
  getGrafanaLiveSrv,
  getTemplateSrv,
  StreamingFrameOptions,
} from '@grafana/runtime';

import { GrafanaQuery, GrafanaQueryType } from './types';

let counter = 100;

export class GrafanaDatasource extends DataSourceWithBackend<GrafanaQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const results: Array<Observable<DataQueryResponse>> = [];
    const targets: GrafanaQuery[] = [];
    const templateSrv = getTemplateSrv();
    for (const target of request.targets) {
      if (target.hide) {
        continue;
      }
      if (target.queryType === GrafanaQueryType.LiveMeasurements) {
        let channel = templateSrv.replace(target.channel, request.scopedVars);
        const { filter } = target;

        const addr = parseLiveChannelAddress(channel);
        if (!isValidLiveChannelAddress(addr)) {
          continue;
        }
        const buffer: Partial<StreamingFrameOptions> = {
          maxLength: request.maxDataPoints ?? 500,
        };
        if (target.buffer) {
          buffer.maxDelta = target.buffer;
          buffer.maxLength = buffer.maxLength! * 2; //??
        } else if (request.rangeRaw?.to === 'now') {
          buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
        }

        results.push(
          getGrafanaLiveSrv().getDataStream({
            key: `${request.requestId}.${counter++}`,
            addr: addr!,
            filter,
            buffer,
          })
        );
      } else {
        if (!target.queryType) {
          target.queryType = GrafanaQueryType.RandomWalk;
        }
        targets.push(target);
      }
    }

    if (targets.length) {
      results.push(
        super.query({
          ...request,
          targets,
        })
      );
    }

    if (results.length) {
      // With a single query just return the results
      if (results.length === 1) {
        return results[0];
      }
      return merge(...results);
    }
    return of(); // nothing
  }

  listFiles(path: string): Observable<DataFrameView<FileElement>> {
    return this.query({
      targets: [
        {
          refId: 'A',
          queryType: GrafanaQueryType.List,
          path,
        },
      ],
    } as any).pipe(
      map((v) => {
        const frame = v.data[0] ?? new MutableDataFrame();
        return new DataFrameView<FileElement>(frame);
      })
    );
  }

  metricFindQuery(options: any) {
    return Promise.resolve([]);
  }

  testDatasource() {
    return Promise.resolve();
  }
}

/** Get the GrafanaDatasource instance */
export async function getGrafanaDatasource() {
  return (await getDataSourceSrv().get('-- Grafana --')) as GrafanaDatasource;
}

export interface FileElement {
  name: string;
  ['media-type']: string;
}
