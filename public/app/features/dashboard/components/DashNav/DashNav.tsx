import React, { FC, ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  ModalsController,
  ToolbarButton,
  PageToolbar,
  useForceUpdate,
  ToolbarButtonRow,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbarSeparator';
import config from 'app/core/config';
import { useBusEvent } from 'app/core/hooks/useBusEvent';
import { t } from 'app/core/internationalization';
import { DashboardCommentsModal } from 'app/features/dashboard/components/DashboardComments/DashboardCommentsModal';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { DashboardMetaChangedEvent } from 'app/types/events';

import { setStarred } from '../../../../core/reducers/navBarTree';
import { getDashboardSrv } from '../../services/DashboardSrv';
import { DashboardModel } from '../../state';

import { DashNavButton } from './DashNavButton';

const mapDispatchToProps = {
  setStarred,
  updateTimeZoneForSession,
};

const connector = connect(null, mapDispatchToProps);

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  folderTitle?: string;
  title: string;
  onAddPanel: () => void;
}

interface DashNavButtonModel {
  show: (props: Props) => boolean;
  component: FC<Partial<Props>>;
  index?: number | 'end';
}

const customLeftActions: DashNavButtonModel[] = [];
const customRightActions: DashNavButtonModel[] = [];

export function addCustomLeftAction(content: DashNavButtonModel) {
  customLeftActions.push(content);
}

export function addCustomRightAction(content: DashNavButtonModel) {
  customRightActions.push(content);
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const DashNav = React.memo<Props>((props) => {
  const forceUpdate = useForceUpdate();

  // We don't really care about the event payload here only that it triggeres a re-render of this component
  useBusEvent(props.dashboard.events, DashboardMetaChangedEvent);

  const onStarDashboard = () => {
    const dashboardSrv = getDashboardSrv();
    const { dashboard, setStarred } = props;

    dashboardSrv.starDashboard(dashboard.id, Boolean(dashboard.meta.isStarred)).then((newState) => {
      setStarred({ id: dashboard.uid, title: dashboard.title, url: dashboard.meta.url ?? '', isStarred: newState });
      dashboard.meta.isStarred = newState;
      forceUpdate();
    });
  };

  const onClose = () => {
    locationService.partial({ viewPanel: null });
  };

  const onOpenSettings = () => {
    locationService.partial({ editview: 'settings' });
  };

  const addCustomContent = (actions: DashNavButtonModel[], buttons: ReactNode[]) => {
    actions.map((action, index) => {
      const Component = action.component;
      const element = <Component {...props} key={`button-custom-${index}`} />;
      typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
    });
  };

  const renderLeftActions = () => {
    const { dashboard } = props;
    const { canStar, isStarred } = dashboard.meta;
    const buttons: ReactNode[] = [];

    if (canStar) {
      let desc = isStarred
        ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
        : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');
      buttons.push(
        <DashNavButton
          tooltip={desc}
          icon={isStarred ? 'favorite' : 'star'}
          iconType={isStarred ? 'mono' : 'default'}
          iconSize="lg"
          onClick={onStarDashboard}
          key="button-star"
        />
      );
    }

    if (dashboard.uid && config.featureToggles.dashboardComments) {
      buttons.push(
        <ModalsController key="button-dashboard-comments">
          {({ showModal, hideModal }) => (
            <DashNavButton
              tooltip={t('dashboard.toolbar.comments-show', 'Show dashboard comments')}
              icon="comment-alt-message"
              iconSize="lg"
              onClick={() => {
                showModal(DashboardCommentsModal, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    addCustomContent(customLeftActions, buttons);
    return buttons;
  };

  const renderRightActions = () => {
    const { dashboard, onAddPanel, isFullscreen } = props;
    const { canSave, canEdit, showSettings } = dashboard.meta;
    const buttons: ReactNode[] = [];

    if (canEdit && !isFullscreen) {
      buttons.push(
        <ToolbarButton
          tooltip={t('dashboard.toolbar.add-panel', 'Add panel')}
          icon="panel-add"
          onClick={onAddPanel}
          key="button-panel-add"
        />
      );
    }

    if (canSave && !isFullscreen) {
      buttons.push(
        <ModalsController key="button-save">
          {({ showModal, hideModal }) => (
            <ToolbarButton
              tooltip={t('dashboard.toolbar.save', 'Save dashboard')}
              icon="save"
              onClick={() => {
                showModal(SaveDashboardDrawer, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    if (showSettings) {
      buttons.push(
        <ToolbarButton
          tooltip={t('dashboard.toolbar.settings', 'Dashboard settings')}
          icon="cog"
          onClick={onOpenSettings}
          key="button-settings"
        />
      );
    }

    addCustomContent(customRightActions, buttons);

    return buttons;
  };

  const { isFullscreen, title, folderTitle } = props;
  // this ensures the component rerenders when the location changes
  const location = useLocation();
  const titleHref = locationUtil.getUrlForPartial(location, { search: 'open' });
  const parentHref = locationUtil.getUrlForPartial(location, { search: 'open', query: 'folder:current' });
  const onGoBack = isFullscreen ? onClose : undefined;

  if (config.featureToggles.topnav) {
    return (
      <AppChromeUpdate
        actions={
          <>
            {renderLeftActions()}
            <NavToolbarSeparator leftActionsSeparator />
            <ToolbarButtonRow alignment="right">{renderRightActions()}</ToolbarButtonRow>
          </>
        }
      />
    );
  }

  return (
    <PageToolbar
      pageIcon={isFullscreen ? undefined : 'apps'}
      title={title}
      parent={folderTitle}
      titleHref={titleHref}
      parentHref={parentHref}
      onGoBack={onGoBack}
      leftItems={renderLeftActions()}
    >
      {renderRightActions()}
    </PageToolbar>
  );
});

DashNav.displayName = 'DashNav';

export default connector(DashNav);
