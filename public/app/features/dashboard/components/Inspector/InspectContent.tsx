import React, { useState } from 'react';

import { formattedValueToString, getValueFormat, PanelData, PanelPlugin } from '@grafana/data';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { InspectTab } from 'app/features/inspector/types';

import { DashboardModel, PanelModel } from '../../state';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  defaultTab?: InspectTab;
  tabs: Array<{ label: string; value: InspectTab }>;
  // The last raw response
  data?: PanelData;
  isDataLoading: boolean;
  // If the datasource supports custom metadata
  onClose: () => void;
}

export const InspectContent = ({
  panel,
  plugin,
  dashboard,
  tabs,
  data,
  isDataLoading,
  defaultTab,
  onClose,
}: Props) => {
  const [currentTab, setCurrentTab] = useState(defaultTab ?? InspectTab.Data);

  if (!plugin) {
    return null;
  }

  const error = data?.error;

  // Validate that the active tab is actually valid and allowed
  let activeTab = currentTab;
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  const panelTitle = panel.title || 'Panel';
  const title = t('dashboard.inspect.title', 'Inspect: {{panelTitle}}', { panelTitle });

  return (
    <Drawer
      title={title}
      subtitle={data && formatStats(data)}
      width="50%"
      onClose={onClose}
      expandable
      scrollableContent
      tabs={
        <TabsBar>
          {tabs.map((tab, index) => {
            return (
              <Tab
                key={`${tab.value}-${index}`}
                label={tab.label}
                active={tab.value === activeTab}
                onChangeTab={() => setCurrentTab(tab.value || InspectTab.Data)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {activeTab === InspectTab.Data && (<></>)}

      {activeTab === InspectTab.JSON && (
        <InspectJSONTab panel={panel} dashboard={dashboard} data={data} onClose={onClose} />
      )}
      {activeTab === InspectTab.Error && <InspectErrorTab error={error} />}
      {data && activeTab === InspectTab.Stats && <InspectStatsTab data={data} />}
      {data && activeTab === InspectTab.Query && (<></>)}
    </Drawer>
  );
};

function formatStats(data: PanelData) {
  const { request } = data;
  if (!request) {
    return '';
  }

  const queryCount = request.targets.length;
  const requestTime = request.endTime ? request.endTime - request.startTime : 0;
  const formatted = formattedValueToString(getValueFormat('ms')(requestTime));

  return (
    <Trans i18nKey="dashboard.inspect.subtitle">
      {{ queryCount }} queries with total query time of {{ formatted }}
    </Trans>
  );
}
