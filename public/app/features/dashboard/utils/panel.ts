import { isString as _isString } from 'lodash';

import { AppEvents, PanelModel as IPanelModel } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { AddLibraryPanelModal } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
import { UnlinkModal } from 'app/features/library-panels/components/UnlinkModal/UnlinkModal';
import { cleanUpPanelState } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';

import { ShowConfirmModalEvent, ShowModalReactEvent } from '../../../types/events';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const confirmText = undefined;

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Remove panel',
        text: 'Are you sure you want to remove this panel?',
        text2: undefined,
        icon: 'trash-alt',
        confirmText: confirmText,
        yesText: 'Remove',
        onConfirm: () => removePanel(dashboard, panel, false),
      })
    );
    return;
  }

  dashboard.removePanel(panel);
  dispatch(cleanUpPanelState(panel.key));
};

export const duplicatePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  dashboard.duplicatePanel(panel);
};

export const copyPanel = (panel: IPanelModel) => {
  let saveModel = panel;
  if (panel instanceof PanelModel) {
    saveModel = panel.getSaveModel();
  }

  store.set(LS_PANEL_COPY_KEY, JSON.stringify(saveModel));
  appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Click **Add panel** icon to paste.']);
};

export const addLibraryPanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.publish(
    new ShowModalReactEvent({
      component: AddLibraryPanelModal,
      props: {
        panel,
        initialFolderUid: dashboard.meta.folderUid,
        isOpen: true,
      },
    })
  );
};

export const unlinkLibraryPanel = (panel: PanelModel) => {
  appEvents.publish(
    new ShowModalReactEvent({
      component: UnlinkModal,
      props: {
        onConfirm: () => panel.unlinkLibraryPanel(),
        isOpen: true,
      },
    })
  );
};
