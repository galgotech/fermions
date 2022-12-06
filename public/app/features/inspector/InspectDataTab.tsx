import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  applyRawFieldOverrides,
  CoreApp,
  CSVConfig,
  DataFrame,
  SelectableValue,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Spinner, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import { Trans } from 'app/core/internationalization';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import { PanelModel } from 'app/features/dashboard/state';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt } from './utils/download';

interface Props {
  isLoading: boolean;
  options: GetDataOptions;
  timeZone: TimeZone;
  app?: CoreApp;
  data?: DataFrame[];
  panel?: PanelModel;
  onOptionsChange?: (options: GetDataOptions) => void;
}

interface State {
  /** The string is joinByField transformation. Otherwise it is a dataframe index */
  selectedDataFrame: number;
  dataFrameIndex: number;
  transformedData: DataFrame[];
  downloadForExcel: boolean;
}

export class InspectDataTab extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      selectedDataFrame: 0,
      dataFrameIndex: 0,
      transformedData: props.data ?? [],
      downloadForExcel: false,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!this.props.data) {
      this.setState({ transformedData: [] });
      return;
    }

    if (prevProps.data !== this.props.data) {
      this.setState({ transformedData: this.props.data });
      return;
    }
  }

  exportCsv = (dataFrame: DataFrame, csvConfig: CSVConfig = {}) => {
    const { panel } = this.props;

    downloadDataFrameAsCsv(dataFrame, panel ? panel.getDisplayTitle() : 'Explore', csvConfig);
  };

  exportLogsAsTxt = () => {
    const { data, panel, app } = this.props;

    reportInteraction('grafana_logs_download_logs_clicked', {
      app,
      format: 'logs',
    });

    const logsModel = dataFrameToLogsModel(data || [], undefined);
    downloadLogsModelAsTxt(logsModel, panel ? panel.getDisplayTitle() : 'Explore');
  };

  exportServiceGraph = () => {
    const { data, panel } = this.props;
    if (!data) {
      return;
    }

    downloadAsJson(data, panel ? panel.getDisplayTitle() : 'Explore');
  };

  onDataFrameChange = (item: SelectableValue<number>) => {
    this.setState({
      dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
      selectedDataFrame: item.value!,
    });
  };

  toggleDownloadForExcel = () => {
    this.setState((prevState) => ({
      downloadForExcel: !prevState.downloadForExcel,
    }));
  };

  getProcessedData(): DataFrame[] {
    const { options, panel, timeZone } = this.props;
    const data = this.state.transformedData;

    if (!options.withFieldConfig || !panel) {
      return applyRawFieldOverrides(data);
    }

    // We need to apply field config even though it was already applied in the PanelQueryRunner.
    // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
    return applyFieldOverrides({
      data,
      theme: config.theme2,
      fieldConfig: panel.fieldConfig,
      timeZone,
      replaceVariables: (value: string) => {
        return value;
      },
    });
  }

  render() {
    const { isLoading, options, data, panel, onOptionsChange, app } = this.props;
    const { dataFrameIndex, selectedDataFrame, downloadForExcel } = this.state;
    const styles = getPanelInspectorStyles();

    if (isLoading) {
      return (
        <div>
          <Spinner inline={true} /> Loading
        </div>
      );
    }

    const dataFrames = this.getProcessedData();

    if (!dataFrames || !dataFrames.length) {
      return <div>No Data</div>;
    }

    // let's make sure we don't try to render a frame that doesn't exists
    const index = !dataFrames[dataFrameIndex] ? 0 : dataFrameIndex;
    const dataFrame = dataFrames[index];
    const hasLogs = dataFrames.some((df) => df?.meta?.preferredVisualisationType === 'logs');
    const hasServiceGraph = dataFrames.some((df) => df?.meta?.preferredVisualisationType === 'nodeGraph');

    return (
      <div className={styles.wrap} aria-label={selectors.components.PanelInspector.Data.content}>
        <div className={styles.toolbar}>
          <InspectDataOptions
            data={data}
            panel={panel}
            options={options}
            dataFrames={dataFrames}
            selectedDataFrame={selectedDataFrame}
            downloadForExcel={downloadForExcel}
            onOptionsChange={onOptionsChange}
            onDataFrameChange={this.onDataFrameChange}
            toggleDownloadForExcel={this.toggleDownloadForExcel}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (hasLogs) {
                reportInteraction('grafana_logs_download_clicked', {
                  app,
                  format: 'csv',
                });
              }
              this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: this.state.downloadForExcel });
            }}
            className={css`
              margin-bottom: 10px;
            `}
          >
            <Trans i18nKey="dashboard.inspect-data.download-csv">Download CSV</Trans>
          </Button>
          {hasLogs && (
            <Button
              variant="primary"
              onClick={this.exportLogsAsTxt}
              className={css`
                margin-bottom: 10px;
                margin-left: 10px;
              `}
            >
              <Trans i18nKey="dashboard.inspect-data.download-logs">Download logs</Trans>
            </Button>
          )}
          {hasServiceGraph && (
            <Button
              variant="primary"
              onClick={this.exportServiceGraph}
              className={css`
                margin-bottom: 10px;
                margin-left: 10px;
              `}
            >
              <Trans i18nKey="dashboard.inspect-data.download-service">Download service graph</Trans>
            </Button>
          )}
        </div>
        <div className={styles.content}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }

              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={dataFrame} showTypeIcons={true} />
                </div>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }
}
