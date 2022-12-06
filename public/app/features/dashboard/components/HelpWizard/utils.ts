import { cloneDeep } from 'lodash';
import { firstValueFrom } from 'rxjs';

import {
  dateTimeFormat,
  TimeRange,
  DataQuery,
  PanelData,
  DataFrameJSON,
  LoadingState,
  dataFrameToJSON,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { PanelModel } from 'app/features/dashboard/state';

import { Randomize, randomizeData } from './randomizer';

export function getPanelDataFrames(data?: PanelData): DataFrameJSON[] {
  const frames: DataFrameJSON[] = [];
  if (data?.series) {
    for (const f of data.series) {
      frames.push(dataFrameToJSON(f));
    }
  }
  return frames;
}

export function getGithubMarkdown(panel: PanelModel): string {
  const saveModel = panel.getSaveModel();
  const info = {
    panelType: saveModel.type,
    datasource: '??',
  };
  const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;

  let md = `| Key | Value |
|--|--|
| Panel | ${info.panelType} @ ${saveModel.pluginVersion ?? grafanaVersion} |
| Grafana | ${grafanaVersion} // ${config.buildInfo.edition} |
`;

  return md;
}

export async function getDebugDashboard(panel: PanelModel, rand: Randomize, timeRange: TimeRange) {
  const saveModel = panel.getSaveModel();
  const dashboard = cloneDeep(embeddedDataTemplate);
  const info = {
    panelType: saveModel.type,
    datasource: '??',
  };

  // reproducable
  const data = await firstValueFrom(
    panel.getQueryRunner().getData({
      withFieldConfig: false,
    })
  );

  const dsref = panel.datasource;
  const frames = randomizeData(getPanelDataFrames(data), rand);
  const grafanaVersion = `${config.buildInfo.version} (${config.buildInfo.commit})`;
  const queries = saveModel?.targets ?? [];
  const html = `<table width="100%">
    <tr>
      <th width="2%">Panel</th>
      <td >${info.panelType} @ ${saveModel.pluginVersion ?? grafanaVersion}</td>
    </tr>
    <tr>
      <th>Queries</th>
      <td>${queries
        .map((t: DataQuery) => {
          const ds = t.datasource ?? dsref;
          return `${t.refId}[${ds?.type}]`;
        })
        .join(', ')}</td>
    </tr>
    ${getDataRow(data, frames)}
    <tr>
      <th>Grafana</th>
      <td>${grafanaVersion} // ${config.buildInfo.edition}</td>
    </tr>
  </table>`.trim();

  // Replace the panel with embedded data
  dashboard.panels[0] = {
    ...saveModel,
    ...dashboard.panels[0],
  };

  dashboard.panels[1].options.content = html;
  dashboard.panels[2].options.content = JSON.stringify(saveModel, null, 2);

  dashboard.title = `Debug: ${saveModel.title} // ${dateTimeFormat(new Date())}`;
  dashboard.tags = ['debug', `debug-${info.panelType}`];
  dashboard.time = {
    from: timeRange.from.toISOString(),
    to: timeRange.to.toISOString(),
  };

  return dashboard;
}

function getDataRow(data: PanelData, frames: DataFrameJSON[]): string {
  let frameCount = data.series.length ?? 0;
  let fieldCount = 0;
  let rowCount = 0;
  for (const frame of data.series) {
    fieldCount += frame.fields.length;
    rowCount += frame.length;
  }
  return (
    '<tr>' +
    '<th>Data</th>' +
    '<td>' +
    `${data.state !== LoadingState.Done ? data.state : ''} ` +
    `${frameCount} frames, ${fieldCount} fields, ` +
    `${rowCount} rows ` +
    // `(${formattedValueToString(getValueFormat('decbytes')(raw?.length))} JSON)` +
    '</td>' +
    '</tr>'
  );
}

// eslint-disable-next-line
const embeddedDataTemplate: any = {
  // should be dashboard model when that is accurate enough
  panels: [
    {
      id: 2,
      title: 'Reproduced with embedded data',
      datasource: {
        type: 'grafana',
        uid: 'grafana',
      },
      gridPos: {
        h: 13,
        w: 15,
        x: 0,
        y: 0,
      },
    },
    {
      gridPos: {
        h: 7,
        w: 9,
        x: 15,
        y: 0,
      },
      id: 5,
      options: {
        content: '...',
        mode: 'html',
      },
      title: 'Debug info',
      type: 'text',
    },
    {
      id: 6,
      title: 'Original Panel JSON',
      type: 'text',
      gridPos: {
        h: 13,
        w: 9,
        x: 15,
        y: 7,
      },
      options: {
        content: '...',
        mode: 'code',
        code: {
          language: 'json',
          showLineNumbers: true,
          showMiniMap: true,
        },
      },
    },
    {
      id: 3,
      title: 'Data from panel above',
      type: 'table',
      datasource: {
        type: 'datasource',
        uid: '-- Dashboard --',
      },
      gridPos: {
        h: 7,
        w: 15,
        x: 0,
        y: 13,
      },
      options: {
        showTypeIcons: true,
      },
      targets: [
        {
          datasource: {
            type: 'datasource',
            uid: '-- Dashboard --',
          },
          panelId: 2,
          refId: 'A',
        },
      ],
    },
  ],
  schemaVersion: 37,
};
