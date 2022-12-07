import React, { useEffect, useState } from 'react';

import { RefreshEvent } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';

import PanelHeaderCorner from '../../dashgrid/PanelHeader/PanelHeaderCorner';
import { DashboardModel, PanelModel } from '../../state';

import { usePanelLatestData } from './usePanelLatestData';

export interface Props {
  width: number;
  height: number;
  panel: PanelModel;
  dashboard: DashboardModel;
}

export function PanelEditorTableView({ width, height, panel, dashboard }: Props) {
  const { data } = usePanelLatestData(panel, false);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
    showTypeIcons: true,
  });

  // Subscribe to panel event
  useEffect(() => {
    const sub = panel.events.subscribe(RefreshEvent, () => {
      panel.runAllPanelQueries({
        dashboardId: dashboard.id,
        dashboardUID: dashboard.uid,
        dashboardTimezone: dashboard.getTimezone(),
        width,
      });
    });
    return () => {
      sub.unsubscribe();
    };
  }, [panel, dashboard, width]);

  if (!data) {
    return null;
  }
  return (
    <PanelChrome width={width} height={height} padding="none">
      {(innerWidth, innerHeight) => (
        <>
          <PanelHeaderCorner panel={panel} error={data?.error?.message} />
          <PanelRenderer
            title="Raw data"
            pluginId="table"
            width={innerWidth}
            height={innerHeight}
            data={data}
            options={options}
            onOptionsChange={setOptions}
          />
        </>
      )}
    </PanelChrome>
  );
}
