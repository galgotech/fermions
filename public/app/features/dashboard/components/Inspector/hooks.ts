import { useMemo } from 'react';

import { DataQueryError, PanelPlugin } from '@grafana/data';
import { t } from 'app/core/internationalization';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectActionSupplier } from './PanelInspectActions';

/**
 * Configures tabs for PanelInspector
 */
export const useInspectTabs = (
  panel: PanelModel,
  dashboard: DashboardModel,
  error?: DataQueryError
) => {
  return useMemo(() => {
    const tabs = [];
    tabs.push({ label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data });
    tabs.push({ label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats });

    tabs.push({ label: t('dashboard.inspect.json-tab', 'JSON'), value: InspectTab.JSON });

    if (error && error.message) {
      tabs.push({ label: t('dashboard.inspect.error-tab', 'Error'), value: InspectTab.Error });
    }

    // This is a quick internal hack to allow custom actions in inspect
    // For 8.1, something like this should be exposed through grafana/runtime
    const supplier = (window as any).grafanaPanelInspectActionSupplier as PanelInspectActionSupplier;
    if (supplier && supplier.getActions(panel)?.length) {
      tabs.push({
        label: t('dashboard.inspect.actions-tab', 'Actions'),
        value: InspectTab.Actions,
      });
    }

    if (dashboard.meta.canEdit) {
      tabs.push({ label: t('dashboard.inspect.query-tab', 'Query'), value: InspectTab.Query });
    }
    return tabs;
  }, [panel, dashboard, error]);
};
