import memoizeOne from 'memoize-one';

import { PanelPlugin } from '@grafana/data';

import { PanelEditorTab, PanelEditorTabId } from '../types';

export const getPanelEditorTabs = memoizeOne((tab?: string, plugin?: PanelPlugin) => {
  const tabs: PanelEditorTab[] = [];

  if (!plugin) {
    return tabs;
  }

  let defaultTab = PanelEditorTabId.Workflow;
  tabs.push({
    id: PanelEditorTabId.Panel,
    text: 'Panel',
    icon: 'database',
    active: false,
  });


  tabs.push({
    id: PanelEditorTabId.Code,
    text: 'Theme',
    icon: 'database',
    active: false,
  });

  tabs.push({
    id: PanelEditorTabId.Workflow,
    text: 'Workflow',
    icon: 'database',
    active: false,
  });

  const activeTab = tabs.find((item) => item.id === (tab || defaultTab)) ?? tabs[0];
  activeTab.active = true;

  return tabs;
});
