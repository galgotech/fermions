import { PanelPlugin } from '@grafana/data';

import { TextPanel } from './TextPanel';
import { PanelOptions } from './models.gen';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<PanelOptions>(TextPanel)
  .setMigrationHandler(textPanelMigrationHandler);
