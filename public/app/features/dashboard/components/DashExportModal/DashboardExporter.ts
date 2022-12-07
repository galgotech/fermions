import { defaults, each, sortBy } from 'lodash';

import { PanelPluginMeta } from '@grafana/data';
import config from 'app/core/config';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { DashboardModel } from '../../state/DashboardModel';
import { GridPos } from '../../state/PanelModel';

interface Input {
  name: string;
  type: string;
  label: string;
  value: any;
  description: string;
}

interface Requires {
  [key: string]: {
    type: string;
    id: string;
    name: string;
    version: string;
  };
}

interface ExternalDashboard {
  __inputs: Input[];
  __elements: Record<string, LibraryElementExport>;
  __requires: Array<Requires[string]>;
  panels: Array<PanelModel | PanelWithExportableLibraryPanel>;
}

interface PanelWithExportableLibraryPanel {
  gridPos: GridPos;
  id: number;
  libraryPanel: {
    name: string;
    uid: string;
  };
}

function isExportableLibraryPanel(p: any): p is PanelWithExportableLibraryPanel {
  return p.libraryPanel && typeof p.libraryPanel.name === 'string' && typeof p.libraryPanel.uid === 'string';
}

interface DataSources {
  [key: string]: {
    name: string;
    label: string;
    description: string;
    type: string;
    pluginId: string;
    pluginName: string;
  };
}

export interface LibraryElementExport {
  name: string;
  uid: string;
  model: any;
  kind: LibraryElementKind;
}

export class DashboardExporter {
  async makeExportable(dashboard: DashboardModel) {
    const saveModel = dashboard.getSaveModelClone();
    saveModel.id = null;

    const inputs: Input[] = [];
    const requires: Requires = {};
    const datasources: DataSources = {};
    const libraryPanels: Map<string, LibraryElementExport> = new Map<string, LibraryElementExport>();

    const processPanel = async (panel: PanelModel) => {
      if (panel.type !== 'row') {
        const panelDef: PanelPluginMeta = config.panels[panel.type];
        if (panelDef) {
          requires['panel' + panelDef.id] = {
            type: 'panel',
            id: panelDef.id,
            name: panelDef.name,
            version: panelDef.info.version,
          };
        }
      }
    };

    const processLibraryPanels = async (panel: PanelModel) => {
      if (isPanelModelLibraryPanel(panel)) {
        const { name, uid } = panel.libraryPanel;
        let model = panel.libraryPanel.model;
        if (!model) {
          const libPanel = await getLibraryPanel(uid, true);
          model = libPanel.model;
        }

        const { gridPos, id, ...rest } = model;
        if (!libraryPanels.has(uid)) {
          libraryPanels.set(uid, { name, uid, kind: LibraryElementKind.Panel, model: rest });
        }
      }
    };

    try {
      // check up panel data sources
      for (const panel of saveModel.panels) {
        await processPanel(panel);

        // handle collapsed rows
        if (panel.panels) {
          for (const rowPanel of panel.panels) {
            await processPanel(rowPanel);
          }
        }
      }

      // add grafana version
      requires['grafana'] = {
        type: 'grafana',
        id: 'grafana',
        name: 'Grafana',
        version: config.buildInfo.version,
      };

      each(datasources, (value: any) => {
        inputs.push(value);
      });

      // we need to process all panels again after all the promises are resolved
      // so all data sources, variables and targets have been templateized when we process library panels
      for (const panel of dashboard.panels) {
        await processLibraryPanels(panel);
        if (panel.panels) {
          for (const rowPanel of panel.panels) {
            await processLibraryPanels(rowPanel);
          }
        }
      }

      const __elements = [...libraryPanels.entries()].reduce<Record<string, LibraryElementExport>>(
        (prev, [curKey, curLibPanel]) => {
          prev[curKey] = curLibPanel;
          return prev;
        },
        {}
      );

      // make inputs and requires a top thing
      const newObj: ExternalDashboard = defaults(
        {
          __inputs: inputs,
          __elements,
          __requires: sortBy(requires, ['id']),
        },
        saveModel
      );

      // Remove extraneous props from library panels
      for (let i = 0; i < newObj.panels.length; i++) {
        const libPanel = newObj.panels[i];
        if (isExportableLibraryPanel(libPanel)) {
          newObj.panels[i] = {
            gridPos: libPanel.gridPos,
            id: libPanel.id,
            libraryPanel: { uid: libPanel.libraryPanel.uid, name: libPanel.libraryPanel.name },
          };
        }
      }

      return newObj;
    } catch (err) {
      console.error('Export failed:', err);
      return {
        error: err,
      };
    }
  }
}
