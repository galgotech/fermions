import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import coreModule from './core_module';
import { UtilSrv } from './services/UtilSrv';

export function registerComponents() {
  coreModule.factory('backendSrv', () => getBackendSrv());
  coreModule.factory('contextSrv', () => contextSrv);
  coreModule.factory('dashboardSrv', () => getDashboardSrv());
  coreModule.factory('linkSrv', () => getLinkSrv());
  coreModule.factory('validationSrv', () => validationSrv);
  coreModule.service('utilSrv', UtilSrv);
}
