import React from 'react';

import { PanelData, QueryResultMetaStat } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';

import { InspectStatsTable } from './InspectStatsTable';

interface InspectStatsTabProps {
  data: PanelData;
}

export const InspectStatsTab: React.FC<InspectStatsTabProps> = ({ data }) => {
  if (!data.request) {
    return null;
  }

  let stats: QueryResultMetaStat[] = [];

  const requestTime = data.request.endTime ? data.request.endTime - data.request.startTime : -1;
  const processingTime = data.timings?.dataProcessingTime || -1;
  let dataRows = 0;

  if (requestTime > 0) {
    stats.push({
      displayName: t('dashboard.inspect-stats.request-time', 'Total request time'),
      value: requestTime,
      unit: 'ms',
    });
  }
  if (processingTime > 0) {
    stats.push({
      displayName: t('dashboard.inspect-stats.processing-time', 'Data processing time'),
      value: processingTime,
      unit: 'ms',
    });
  }
  stats.push({
    displayName: t('dashboard.inspect-stats.queries', 'Number of queries'),
    value: data.request.targets.length,
  });
  stats.push({
    displayName: t('dashboard.inspect-stats.rows', 'Total number rows'),
    value: dataRows,
  });

  let dataStats: QueryResultMetaStat[] = [];
  const statsTableName = t('dashboard.inspect-stats.table-title', 'Stats');
  const dataStatsTableName = t('dashboard.inspect-stats.data-title', 'Data source stats');

  return (
    <div aria-label={selectors.components.PanelInspector.Stats.content}>
      <InspectStatsTable name={statsTableName} stats={stats} />
      <InspectStatsTable name={dataStatsTableName} stats={dataStats} />
    </div>
  );
};
