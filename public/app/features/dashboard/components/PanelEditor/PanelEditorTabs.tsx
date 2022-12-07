import { css } from '@emotion/css';
import React, { FC, useEffect } from 'react';
import { Subscription } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { Tab, TabContent, TabsBar, toIconName, useForceUpdate, useStyles2 } from '@grafana/ui';
import { PanelQueriesChangedEvent } from 'app/types/events';

import { DashboardModel, PanelModel } from '../../state';

import { PanelEditorTab, PanelEditorTabId } from './types';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  tabs: PanelEditorTab[];
  onChangeTab: (tab: PanelEditorTab) => void;
}

export const PanelEditorTabs: FC<PanelEditorTabsProps> = React.memo(({ panel, dashboard, tabs, onChangeTab }) => {
  const forceUpdate = useForceUpdate();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(panel.events.subscribe(PanelQueriesChangedEvent, forceUpdate));
    return () => eventSubs.unsubscribe();
  }, [panel, dashboard, forceUpdate]);

  // const activeTab = tabs.find((item) => item.active)!;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <TabsBar className={styles.tabBar} hideBorder>
        {tabs.map((tab) => {
          return (
            <Tab
              key={tab.id}
              label={tab.text}
              active={tab.active}
              onChangeTab={() => onChangeTab(tab)}
              icon={toIconName(tab.icon)}
              counter={getCounter(panel, tab)}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        a
      </TabContent>
    </div>
  );
});

PanelEditorTabs.displayName = 'PanelEditorTabs';

function getCounter(panel: PanelModel, tab: PanelEditorTab) {
  switch (tab.id) {
    case PanelEditorTabId.Query:
      return panel.targets.length;
    case PanelEditorTabId.Alert:
      return panel.alert ? 1 : 0;
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    tabBar: css`
      padding-left: ${theme.spacing(2)};
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      border-left: none;
      border-bottom: none;
      border-top-right-radius: ${theme.shape.borderRadius(1.5)};
    `,
  };
};
