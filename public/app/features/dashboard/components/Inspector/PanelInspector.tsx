import React from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { PanelPlugin } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types';

import { HelpWizard } from '../HelpWizard/HelpWizard';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';

import { InspectContent } from './InspectContent';
import { useInspectTabs } from './hooks';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export interface ConnectedProps {
  plugin?: PanelPlugin | null;
}

export type Props = OwnProps & ConnectedProps;

const PanelInspectorUnconnected = ({ panel, dashboard, plugin }: Props) => {
  const location = useLocation();
  const { data, isLoading, error } = usePanelLatestData(panel, true);
  const tabs = useInspectTabs(panel, dashboard, error);
  const defaultTab = new URLSearchParams(location.search).get('inspectTab') as InspectTab;

  const onClose = () => {
    locationService.partial({
      inspect: null,
      inspectTab: null,
    });
  };

  if (!plugin) {
    return null;
  }

  if (defaultTab === InspectTab.Help) {
    return <HelpWizard panel={panel} plugin={plugin} onClose={onClose} />;
  }

  return (
    <InspectContent
      dashboard={dashboard}
      panel={panel}
      plugin={plugin}
      defaultTab={defaultTab}
      tabs={tabs}
      data={data}
      isDataLoading={isLoading}
      onClose={onClose}
    />
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  const panelState = getPanelStateForModel(state, props.panel);
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};

export const PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
