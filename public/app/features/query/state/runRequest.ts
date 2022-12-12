// Libraries
import { map as isArray } from 'lodash';
import { from, merge, Observable, of, timer } from 'rxjs';
import { catchError, map, mapTo, share, takeUntil, tap } from 'rxjs/operators';

// Utils & Services
// Types
import {
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { cancelNetworkRequestsOnUnsubscribe } from './processing/canceler';
import { emitDataRequestEvent } from './queryAnalytics';

type MapOfResponsePackets = { [str: string]: DataQueryResponse };

interface RunningQueryState {
  packets: { [key: string]: DataQueryResponse };
  panelData: PanelData;
}

/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(packet: DataQueryResponse, state: RunningQueryState): RunningQueryState {
  const request = state.panelData.request!;
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  // updates to the same key will replace previous values
  const key = packet.key ?? packet.data?.[0]?.refId ?? 'A';
  packets[key] = packet;

  let loadingState = packet.state || LoadingState.Done;
  let error: DataQueryError | undefined = undefined;

  const series: DataQueryResponseData[] = [];

  for (const key in packets) {
    const packet = packets[key];

    if (packet.error) {
      loadingState = LoadingState.Error;
      error = packet.error;
    }

    if (packet.data && packet.data.length) {
      for (const dataItem of packet.data) {
        series.push(dataItem);
      }
    }
  }

  const panelData = {
    state: loadingState,
    series,
    error,
    request,
  };

  return { packets, panelData };
}

/**
 * This function handles the execution of requests & and processes the single or multiple response packets into
 * a combined PanelData response. It will
 *  Merge multiple responses into a single DataFrame array based on the packet key
 *  Will emit a loading state if no response after 50ms
 *  Cancel any still running network requests on unsubscribe (using request.requestId)
 */
export function runRequest(request: DataQueryRequest): Observable<PanelData> {
  let state: RunningQueryState = {
    panelData: {
      state: LoadingState.Loading,
      data: undefined,
      request: request,
    },
    packets: {},
  };

  // Return early if there are no queries to run
  if (!request.targets.length) {
    request.endTime = Date.now();
    state.panelData.state = LoadingState.Done;
    return of(state.panelData);
  }

  const dataObservable = callQueryMethod(request).pipe(
    // Transform response packets into PanelData with merged results
    map((packet: DataQueryResponse) => {
      if (!isArray(packet.data)) {
        throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
      }

      request.endTime = Date.now();

      state = processResponsePacket(packet, state);

      return state.panelData;
    }),
    // handle errors
    catchError((err) => {
      const errLog = typeof err === 'string' ? err : JSON.stringify(err);
      console.error('runRequest.catchError', errLog);
      return of({
        ...state.panelData,
        state: LoadingState.Error,
        error: toDataQueryError(err),
      });
    }),
    tap(emitDataRequestEvent()),
    // finalize is triggered when subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  // mapTo will translate the timer event into state.panelData (which has state set to loading)
  // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
  return merge(timer(200).pipe(mapTo(state.panelData), takeUntil(dataObservable)), dataObservable);
}

export function callQueryMethod(request: DataQueryRequest) {
  console.log("------------------------- call grafana proxy ", request);
  const returnVal = of();
  return from(returnVal);
}
