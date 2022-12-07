import React, { useCallback } from 'react';

import { Button } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { isDataSourceEditor } from '../../permissions';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement | null {
  const dispatch = useDispatch();
  const onAddDataSource = useCallback(() => {}, [dispatch, plugin]);

  if (!isDataSourceEditor()) {
    return null;
  }

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Create a {plugin.name} data source
    </Button>
  );
}
