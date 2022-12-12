import { PanelData, LoadingState, urlUtil } from '@grafana/data';
import { reportMetaAnalytics, MetaAnalyticsEventName, DataRequestEventPayload } from '@grafana/runtime';

import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';

export function emitDataRequestEvent() {
  let done = false;

  return (data: PanelData) => {
    if (!data.request || done) {
      return;
    }

    const params = urlUtil.getUrlSearchParams();
    if (params.editPanel != null) {
      return;
    }

    if (data.state !== LoadingState.Done && data.state !== LoadingState.Error) {
      return;
    }

    const totalQueries = 0;
    const cachedQueries = 0;

    const eventData: DataRequestEventPayload = {
      eventName: MetaAnalyticsEventName.DataRequest,
      panelId: data.request.panelId,
      dashboardId: data.request.dashboardId,
      dataSize: 0,
      duration: data.request.endTime! - data.request.startTime,
      totalQueries,
      cachedQueries,
    };

    // enrich with dashboard info
    const dashboard = getDashboardSrv().getCurrent();
    if (dashboard) {
      eventData.dashboardId = dashboard.id;
      eventData.dashboardName = dashboard.title;
      eventData.dashboardUid = dashboard.uid;
      eventData.folderName = dashboard.meta.folderTitle;
    }

    if (data.error) {
      eventData.error = data.error.message;
    }

    reportMetaAnalytics(eventData);

    // this done check is to make sure we do not double emit events in case
    // there are multiple responses with done state
    done = true;
  };
}
