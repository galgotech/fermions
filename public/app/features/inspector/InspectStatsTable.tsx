import { css } from '@emotion/css';
import React from 'react';

import {
  GrafanaTheme2,
  QueryResultMetaStat,
} from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';

interface InspectStatsTableProps {
  name: string;
  stats: QueryResultMetaStat[];
}

export const InspectStatsTable: React.FC<InspectStatsTableProps> = ({ name, stats }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (!stats || !stats.length) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className="section-heading">{name}</div>
      <table className="filter-table width-30">
        <tbody>
          {stats.map((stat, index) => {
            return (
              <tr key={`${stat.displayName}-${index}`}>
                <td>{stat.displayName}</td>
                <td className={styles.cell}>{stat.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      padding-bottom: ${theme.spacing(2)};
    `,
    cell: css`
      text-align: right;
    `,
  };
});
