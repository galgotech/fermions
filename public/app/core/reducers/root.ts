import { AnyAction, combineReducers } from 'redux';

import sharedReducers from 'app/core/reducers';
import ldapReducers from 'app/features/admin/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import panelEditorReducers from 'app/features/dashboard/components/PanelEditor/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import foldersReducers from 'app/features/folders/state/reducers';
import invitesReducers from 'app/features/invites/state/reducers';
import importDashboardReducers from 'app/features/manage-dashboards/state/reducers';
import organizationReducers from 'app/features/org/state/reducers';
import panelsReducers from 'app/features/panel/state/reducers';
import { reducer as pluginsReducer } from 'app/features/plugins/admin/state/reducer';
import userReducers from 'app/features/profile/state/reducers';
import serviceAccountsReducer from 'app/features/serviceaccounts/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import usersReducers from 'app/features/users/state/reducers';

import { cleanUpAction } from '../actions/cleanUp';

const rootReducers = {
  ...sharedReducers,
  ...teamsReducers,
  ...apiKeysReducers,
  ...foldersReducers,
  ...dashboardReducers,
  ...dataSourcesReducers,
  ...usersReducers,
  ...serviceAccountsReducer,
  ...userReducers,
  ...invitesReducers,
  ...organizationReducers,
  ...ldapReducers,
  ...importDashboardReducers,
  ...panelEditorReducers,
  ...panelsReducers,
  plugins: pluginsReducer,
  [publicDashboardApi.reducerPath]: publicDashboardApi.reducer,
};

const addedReducers = {};

export const addReducer = (newReducers: any) => {
  Object.assign(addedReducers, newReducers);
};

export const createRootReducer = () => {
  const appReducer = combineReducers({
    ...rootReducers,
    ...addedReducers,
  });

  return (state: any, action: AnyAction) => {
    if (action.type !== cleanUpAction.type) {
      return appReducer(state, action);
    }

    const { cleanupAction } = action.payload;
    cleanupAction(state);

    return appReducer(state, action);
  };
};
