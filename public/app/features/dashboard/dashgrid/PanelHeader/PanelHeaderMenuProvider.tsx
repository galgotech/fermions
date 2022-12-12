import { FC, ReactElement, useEffect, useState } from 'react';

import { PanelMenuItem } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';
import { getPanelMenu } from '../../utils/getPanelMenu';

interface PanelHeaderMenuProviderApi {
  items: PanelMenuItem[];
}

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  children: (props: PanelHeaderMenuProviderApi) => ReactElement;
}

export const PanelHeaderMenuProvider: FC<Props> = ({ panel, dashboard, children }) => {
  const [items, setItems] = useState<PanelMenuItem[]>([]);

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel));
  }, [dashboard, panel, setItems]);

  return children({ items });
};
