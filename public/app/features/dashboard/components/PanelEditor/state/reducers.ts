import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { LoadingState, PanelData } from '@grafana/data';

import store from '../../../../../core/store';
import { PanelModel } from '../../../state/PanelModel';
import { DisplayMode } from '../types';

export const PANEL_EDITOR_UI_STATE_STORAGE_KEY = 'grafana.dashboard.editor.ui';

export const DEFAULT_PANEL_EDITOR_UI_STATE: PanelEditorUIState = {
  rightPaneSize: 800,
  topPaneSize: 0.45,
  mode: DisplayMode.Fill,
};

export interface PanelEditorUIState {
  /* Pixels or percentage */
  rightPaneSize: number;
  /* Pixels or percentage */
  topPaneSize: number;
  /* Visualization size mode */
  mode: DisplayMode;
}

export interface PanelEditorState {
  /* These are functions as they are mutated later on and redux toolkit will Object.freeze state so
   * we need to store these using functions instead */
  getSourcePanel: () => PanelModel;
  getPanel: () => PanelModel;
  getData: () => PanelData;
  initDone: boolean;
  shouldDiscardChanges: boolean;
  isOpen: boolean;
  ui: PanelEditorUIState;
}

export const initialState = (): PanelEditorState => {
  const storedUiState = store.getObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, DEFAULT_PANEL_EDITOR_UI_STATE);

  let migratedState = { ...storedUiState };

  if (typeof storedUiState.topPaneSize === 'string') {
    migratedState = { ...storedUiState, topPaneSize: parseFloat(storedUiState.topPaneSize) / 100 };
  }

  return {
    getPanel: () => new PanelModel({}),
    getSourcePanel: () => new PanelModel({}),
    getData: () => ({
      state: LoadingState.NotStarted,
    }),
    initDone: false,
    shouldDiscardChanges: false,
    isOpen: false,
    ui: {
      ...DEFAULT_PANEL_EDITOR_UI_STATE,
      ...migratedState,
    },
  };
};

interface InitEditorPayload {
  panel: PanelModel;
  sourcePanel: PanelModel;
}

const pluginsSlice = createSlice({
  name: 'panelEditor',
  initialState: initialState(),
  reducers: {
    updateEditorInitState: (state, action: PayloadAction<InitEditorPayload>) => {
      state.getPanel = () => action.payload.panel;
      state.getSourcePanel = () => action.payload.sourcePanel;
      state.initDone = true;
      state.isOpen = true;
      state.shouldDiscardChanges = false;
    },
    setEditorPanelData: (state, action: PayloadAction<PanelData>) => {
      state.getData = () => action.payload;
    },
    setDiscardChanges: (state, action: PayloadAction<boolean>) => {
      state.shouldDiscardChanges = action.payload;
    },
    setPanelEditorUIState: (state, action: PayloadAction<Partial<PanelEditorUIState>>) => {
      state.ui = { ...state.ui, ...action.payload };
    },
    closeEditor: (state) => {
      state.isOpen = false;
      state.initDone = false;
    },
  },
});

export const {
  updateEditorInitState,
  setEditorPanelData,
  setDiscardChanges,
  closeEditor,
  setPanelEditorUIState,
} = pluginsSlice.actions;

export const panelEditorReducer = pluginsSlice.reducer;

export default {
  panelEditor: panelEditorReducer,
};
