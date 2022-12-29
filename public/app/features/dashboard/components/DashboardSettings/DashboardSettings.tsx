import * as H from 'history';
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil, NavModel, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PageToolbar } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';

import { DashboardModel } from '../../state/DashboardModel';
import { AccessControlDashboardPermissions } from '../DashboardPermissions/AccessControlDashboardPermissions';
import { SaveDashboardAsButton, SaveDashboardButton, PublishDashboardButton } from '../SaveDashboard/SaveDashboardButton';

import { GeneralSettings } from './GeneralSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { VersionsSettings } from './VersionsSettings';
import { SettingsPage } from './types';

export interface Props {
  dashboard: DashboardModel;
  sectionNav: NavModel;
  pageNav: NavModelItem;
  editview: string;
}

const onClose = () => locationService.partial({ editview: null, editIndex: null });

export function DashboardSettings({ dashboard, editview, pageNav, sectionNav }: Props) {
  const pages = useMemo(() => getSettingsPages(dashboard), [dashboard]);

  const onPostSave = () => {
    dashboard.meta.hasUnsavedFolderChange = false;
  };

  const folderTitle = dashboard.meta.folderTitle;
  const currentPage = pages.find((page) => page.id === editview) ?? pages[0];
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const canSave = dashboard.meta.canSave;
  const location = useLocation();
  const editIndex = getEditIndex(location);
  const subSectionNav = getSectionNav(pageNav, sectionNav, pages, currentPage, location);
  const size = config.featureToggles.topnav ? 'sm' : 'md';

  const actions = [
    canSaveAs && (
      <SaveDashboardAsButton
        dashboard={dashboard}
        onSaveSuccess={onPostSave}
        variant="secondary"
        key="save as"
        size={size}
      />
    ),
    canSave && <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onPostSave} key="Save" size={size} />,
    <PublishDashboardButton dashboard={dashboard} onSaveSuccess={onPostSave} key="Publish" size={size} />,
  ];

  return (
    <>
      {!config.featureToggles.topnav ? (
        <PageToolbar title={`${dashboard.title} / Settings`} parent={folderTitle} onGoBack={onClose}>
          {actions}
        </PageToolbar>
      ) : (
        <AppChromeUpdate actions={actions} />
      )}
      <currentPage.component sectionNav={subSectionNav} dashboard={dashboard} editIndex={editIndex} />
    </>
  );
}

function getSettingsPages(dashboard: DashboardModel) {
  const pages: SettingsPage[] = [];

  if (dashboard.meta.canEdit) {
    pages.push({
      title: 'General',
      id: 'settings',
      icon: 'sliders-v-alt',
      component: GeneralSettings,
    });
  }

  if (dashboard.id && dashboard.meta.canSave) {
    pages.push({
      title: 'Versions',
      id: 'versions',
      icon: 'history',
      component: VersionsSettings,
    });
  }

  if (dashboard.id && dashboard.meta.canAdmin) {
    pages.push({
      title: 'Permissions',
      id: 'permissions',
      icon: 'lock',
      component: AccessControlDashboardPermissions,
    });
  
  }

  pages.push({
    title: 'JSON Model',
    id: 'dashboard_json',
    icon: 'arrow',
    component: JsonEditorSettings,
  });

  return pages;
}

function getSectionNav(
  pageNav: NavModelItem,
  sectionNav: NavModel,
  pages: SettingsPage[],
  currentPage: SettingsPage,
  location: H.Location
): NavModel {
  const main: NavModelItem = {
    text: 'Settings',
    children: [],
    icon: 'apps',
    hideFromBreadcrumbs: true,
  };

  main.children = pages.map((page) => ({
    text: page.title,
    icon: page.icon,
    id: page.id,
    url: locationUtil.getUrlForPartial(location, { editview: page.id, editIndex: null }),
    active: page === currentPage,
    parentItem: main,
    subTitle: page.subTitle,
  }));

  if (pageNav.parentItem) {
    pageNav = {
      ...pageNav,
      parentItem: {
        ...pageNav.parentItem,
        parentItem: sectionNav.node,
      },
    };
  } else {
    pageNav = {
      ...pageNav,
      parentItem: sectionNav.node,
    };
  }

  main.parentItem = pageNav;

  return {
    main,
    node: main.children.find((x) => x.active)!,
  };
}

function getEditIndex(location: H.Location): number | undefined {
  const editIndex = new URLSearchParams(location.search).get('editIndex');
  if (editIndex != null) {
    return parseInt(editIndex, 10);
  }
  return undefined;
}
