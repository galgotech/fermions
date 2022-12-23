import { createSlice, createEntityAdapter, Reducer, AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { PanelPlugin } from '@grafana/data';

import { CatalogPlugin, PluginListDisplayMode, ReducerState } from '../types';

import { loadPluginDashboards, panelPluginLoaded } from './actions';

export const pluginsAdapter = createEntityAdapter<CatalogPlugin>();

export const initialState: ReducerState = {
  items: pluginsAdapter.getInitialState(),
  requests: {},
  settings: {
    displayMode: PluginListDisplayMode.Grid,
  },
  // Backwards compatibility
  // (we need to have the following fields in the store as well to be backwards compatible with other parts of Grafana)
  // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
  plugins: [],
  errors: [],
  searchQuery: '',
  hasFetched: false,
  dashboards: [],
  isLoadingPluginDashboards: false,
  panels: {},
};

const slice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      // Load a panel plugin (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(panelPluginLoaded, (state, action: PayloadAction<PanelPlugin>) => {
        state.panels[action.payload.meta.id] = action.payload;
      })
      // Start loading panel dashboards (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(loadPluginDashboards.pending, (state, action) => {
        state.isLoadingPluginDashboards = true;
        state.dashboards = [];
      })
      // Load panel dashboards (backward-compatibility)
      // TODO<remove once the "plugin_admin_enabled" feature flag is removed>
      .addCase(loadPluginDashboards.fulfilled, (state, action) => {
        state.isLoadingPluginDashboards = false;
        // eslint-disable-next-line
        state.dashboards = action.payload as any; // WritableDraft<PluginDashboard>[],...>
      }),
});

export const reducer: Reducer<ReducerState, AnyAction> = slice.reducer;
