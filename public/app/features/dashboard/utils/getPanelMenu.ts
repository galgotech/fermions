import { PanelMenuItem } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  addLibraryPanel,
  copyPanel,
  duplicatePanel,
  removePanel,
  unlinkLibraryPanel,
} from 'app/features/dashboard/utils/panel';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    locationService.partial({
      viewPanel: panel.id,
    });
  };

  const onEditPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });
  };

  const onAddLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });

    reportInteraction('grafana_panel_menu_inspect', {
      tab: tab ?? InspectTab.Data,
    });
  };

  const onMore = (event: React.MouseEvent<any>) => {
    event.preventDefault();
  };

  const onDuplicatePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
  };

  const onCopyPanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    copyPanel(panel);
  };

  const onRemovePanel = (event: React.MouseEvent<any>) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
  };

  const menu: PanelMenuItem[] = [];

  if (!panel.isEditing) {
    const viewTextTranslation = t('panel.header-menu.view', `View`);
    menu.push({
      text: viewTextTranslation,
      iconClassName: 'eye',
      onClick: onViewPanel,
      shortcut: 'v',
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing) {
    menu.push({
      text: 'Edit',
      iconClassName: 'edit',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin) {
    const dataTextTranslation = t('panel.header-menu.inspect-data', `Data`);

    inspectMenu.push({
      text: dataTextTranslation,
      onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: 'Query',
        onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.Query),
      });
    }
  }

  const jsonTextTranslation = t('panel.header-menu.inspect-json', `Panel JSON`);

  inspectMenu.push({
    text: jsonTextTranslation,
    onClick: (e: React.MouseEvent<any>) => onInspectPanel(InspectTab.JSON),
  });

  const inspectTextTranslation = t('panel.header-menu.inspect', `Inspect`);

  menu.push({
    type: 'submenu',
    text: inspectTextTranslation,
    iconClassName: 'info-circle',
    onClick: (e: React.MouseEvent<any>) => onInspectPanel(),
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const subMenu: PanelMenuItem[] = [];
  const canEdit = dashboard.canEditPanel(panel);

  if (canEdit && !(panel.isViewing || panel.isEditing)) {
    subMenu.push({
      text: 'Duplicate',
      onClick: onDuplicatePanel,
      shortcut: 'p d',
    });

    subMenu.push({
      text: 'Copy',
      onClick: onCopyPanel,
    });

    if (isPanelModelLibraryPanel(panel)) {
      subMenu.push({
        text: 'Unlink library panel',
        onClick: onUnlinkLibraryPanel,
      });
    } else {
      subMenu.push({
        text: 'Create library panel',
        onClick: onAddLibraryPanel,
      });
    }
  }

  // When editing hide most actions
  if (panel.isEditing) {
    subMenu.length = 0;
  }

  if (canEdit && panel.plugin) {
    subMenu.push({
      text: 'Get help',
      onClick: (e: React.MouseEvent) => onInspectPanel(InspectTab.Help),
    });
  }

  if (subMenu.length) {
    const moreTextTranslation = t('panel.header-menu.more', `More...`);
    menu.push({
      type: 'submenu',
      text: moreTextTranslation,
      iconClassName: 'cube',
      subMenu,
      onClick: onMore,
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
    menu.push({ type: 'divider', text: '' });

    menu.push({
      text: 'Remove',
      iconClassName: 'trash-alt',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}
