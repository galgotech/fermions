import React, { FC } from 'react';

import { DataFrame, getFrameDisplayName, SelectableValue } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { t } from 'app/core/internationalization';
import { PanelModel } from 'app/features/dashboard/state';
import { DetailText } from 'app/features/inspector/DetailText';

import { getPanelInspectorStyles } from './styles';

interface Props {
  dataFrames: DataFrame[];
  selectedDataFrame: number;
  downloadForExcel: boolean;
  onDataFrameChange: (item: SelectableValue<number>) => void;
  toggleDownloadForExcel: () => void;
  data?: DataFrame[];
  panel?: PanelModel;
}

export const InspectDataOptions: FC<Props> = ({
  data,
  dataFrames,
  selectedDataFrame,
  onDataFrameChange,
  downloadForExcel,
  toggleDownloadForExcel,
}) => {
  const styles = getPanelInspectorStyles();
  let dataSelect = dataFrames;
  const choices = dataSelect.map((frame, index) => {
    return {
      value: index,
      label: `${getFrameDisplayName(frame)} (${index})`,
    } as SelectableValue<number>;
  });

  const selectableOptions = [...choices];

  function getActiveString() {
    let activeString = '';

    if (!data) {
      return activeString;
    }

    const parts: string[] = [];

    if (data.length > 1) {
      parts.push(getFrameDisplayName(data[selectedDataFrame as number]));
    }

    if (downloadForExcel) {
      parts.push(t('dashboard.inspect-data.excel-header', 'Excel header'));
    }

    return parts.join(', ');
  }

  return (
    <div className={styles.dataDisplayOptions}>
      <QueryOperationRow
        id="Data options"
        index={0}
        title={t('dashboard.inspect-data.data-options', 'Data options')}
        headerElement={<DetailText>{getActiveString()}</DetailText>}
        isOpen={false}
      >
        <div className={styles.options} data-testid="dataOptions">
          <VerticalGroup spacing="none">
            {data!.length > 1 && (
              <Field label={t('dashboard.inspect-data.dataframe-label', 'Show data frame')}>
                <Select
                  options={selectableOptions}
                  value={selectedDataFrame}
                  onChange={onDataFrameChange}
                  width={30}
                  aria-label={t('dashboard.inspect-data.dataframe-aria-label', 'Select dataframe')}
                />
              </Field>
            )}

            <HorizontalGroup>
              <Field
                label={t('dashboard.inspect-data.download-excel-label', 'Download for Excel')}
                description={t(
                  'dashboard.inspect-data.download-excel-description',
                  'Adds header to CSV for use with Excel'
                )}
              >
                <Switch id="excel-toggle" value={downloadForExcel} onChange={toggleDownloadForExcel} />
              </Field>
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </QueryOperationRow>
    </div>
  );
};
