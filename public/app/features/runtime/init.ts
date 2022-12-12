import { PanelData } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

/**
 * This will setup features that are accessible through the root window location
 *
 * This is useful for manipulating the application from external drivers like puppetter/cypress
 *
 * @internal and subject to change
 */
export function initWindowRuntime() {
  (window as any).grafanaRuntime = {
    /** Get info for the current dashboard.  This will include the migrated dashboard JSON */
    getDashboardSaveModel: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.getSaveModelClone();
    },

    /** Get the query results for the last loaded data */
    getPanelData: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.panels.reduce((acc, panel) => {
        acc[panel.id] = panel.getQueryRunner().getLastResult();
        return acc;
      }, {} as Record<number, PanelData | undefined>);
    },
  };
}
