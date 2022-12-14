import { cloneDeep, defaults as _defaults, isEqual, map, maxBy } from 'lodash';
import { Subscription } from 'rxjs';

import {
  AppEvent,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  DateTimeInput,
  EventBusExtended,
  EventBusSrv,
  PanelModel as IPanelModel,
} from '@grafana/data';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { DashboardMeta } from 'app/types';
import { DashboardMetaChangedEvent, DashboardPanelsChangedEvent } from 'app/types/events';

import { mergePanels, PanelMergeInfo } from '../utils/panelMerge';

import { DashboardMigrator } from './DashboardMigrator';
import { GridPos, PanelModel } from './PanelModel';

export interface CloneOptions {
  message?: string;
}

export type DashboardLinkType = 'link' | 'dashboards';

export interface DashboardLink {
  icon: string;
  title: string;
  tooltip: string;
  type: DashboardLinkType;
  url: string;
  asDropdown: boolean;
  tags: any[];
  searchHits?: any[];
  targetBlank: boolean;
  keepTime: boolean;
  includeVars: boolean;
}

export class DashboardModel {
  id: any;
  uid: string;
  title: string;
  autoUpdate: any;
  description: any;
  tags: any;
  style: any;
  liveNow: boolean;
  timepicker: any;
  templating: { list: any[] };
  refresh: any;
  schemaVersion: number;
  version: number;
  revision: number;
  links: DashboardLink[];
  gnetId: any;
  panels: PanelModel[];
  panelInEdit?: PanelModel;
  panelInView?: PanelModel;
  private appEventsSubscription: Subscription;

  // ------------------
  // not persisted
  // ------------------

  // repeat process cycles
  declare meta: DashboardMeta;
  events: EventBusExtended;

  static nonPersistedProperties: { [str: string]: boolean } = {
    events: true,
    meta: true,
    panels: true, // needs special handling
    templating: true, // needs special handling
    originalTime: true,
    originalLibraryPanels: true,
    panelInEdit: true,
    panelInView: true,
    formatDate: true,
    appEventsSubscription: true,
    lastRefresh: true,
  };

  constructor(data: any, meta?: DashboardMeta) {
    if (!data) {
      data = {};
    }

    this.events = new EventBusSrv();
    this.id = data.id || null;
    this.uid = data.uid || null;
    this.revision = data.revision;
    this.title = data.title ?? 'No Title';
    this.autoUpdate = data.autoUpdate;
    this.description = data.description;
    this.tags = data.tags ?? [];
    this.style = data.style ?? 'dark';
    this.liveNow = Boolean(data.liveNow);
    this.templating = this.ensureListExist(data.templating);
    this.schemaVersion = data.schemaVersion ?? 0;
    this.version = data.version ?? 0;
    this.links = data.links ?? [];
    this.gnetId = data.gnetId || null;
    this.panels = map(data.panels ?? [], (panelData: any) => new PanelModel(panelData));
    this.ensurePanelsHaveIds();
    this.formatDate = this.formatDate.bind(this);


    this.initMeta(meta);
    this.updateSchema(data);

    this.sortPanelsByGridPos();
    this.appEventsSubscription = new Subscription();
  }

  private initMeta(meta?: DashboardMeta) {
    meta = meta || {};

    meta.canSave = meta.canSave !== false;
    meta.canStar = meta.canStar !== false;
    meta.canEdit = meta.canEdit !== false;
    meta.canDelete = meta.canDelete !== false;

    meta.showSettings = meta.canEdit;
    meta.hasUnsavedFolderChange = false;

    this.meta = meta;
  }

  // cleans meta data and other non persistent state
  getSaveModelClone(): DashboardModel {
    // make clone
    let copy: any = {};
    for (const property in this) {
      if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      copy[property] = cloneDeep(this[property]);
    }

    // get panel save models
    copy.panels = this.getPanelSaveModels();

    //  sort by keys
    copy = sortedDeepCloneWithoutNulls(copy);

    return copy;
  }

  /**
   * This will load a new dashboard, but keep existing panels unchanged
   *
   * This function can be used to implement:
   * 1. potentially faster loading dashboard loading
   * 2. dynamic dashboard behavior
   * 3. "live" dashboard editing
   *
   * @internal and experimental
   */
  updatePanels(panels: IPanelModel[]): PanelMergeInfo {
    const info = mergePanels(this.panels, panels ?? []);
    if (info.changed) {
      this.panels = info.panels ?? [];
      this.sortPanelsByGridPos();
      this.events.publish(new DashboardPanelsChangedEvent());
    }
    return info;
  }

  private getPanelSaveModels() {
    return this.panels
      .filter((panel) => !(panel.type === 'add-panel'))
      .map((panel) => {
        // Clean libarary panels on save
        if (panel.libraryPanel) {
          const { id, title, libraryPanel, gridPos } = panel;
          return {
            id,
            title,
            gridPos,
            libraryPanel: {
              uid: libraryPanel.uid,
              name: libraryPanel.name,
            },
          };
        }

        // If we save while editing we should include the panel in edit mode instead of the
        // unmodified source panel
        if (this.panelInEdit && this.panelInEdit.id === panel.id) {
          return this.panelInEdit.getSaveModel();
        }

        return panel.getSaveModel();
      });
  }

  render() {
   for (const panel of this.panels) {
      panel.render();
    }
  }

  panelInitialized(panel: PanelModel) {
    const lastResult = panel.getQueryRunner().getLastResult();

    if (!this.otherPanelInFullscreen(panel) && !lastResult) {
      panel.render();
    }
  }

  otherPanelInFullscreen(panel: PanelModel) {
    return (this.panelInEdit || this.panelInView) && !(panel.isViewing || panel.isEditing);
  }

  initEditPanel(sourcePanel: PanelModel): PanelModel {
    this.panelInEdit = sourcePanel.getEditClone();
    return this.panelInEdit;
  }

  initViewPanel(panel: PanelModel) {
    this.panelInView = panel;
    panel.setIsViewing(true);
  }

  exitViewPanel(panel: PanelModel) {
    this.panelInView = undefined;
    panel.setIsViewing(false);
  }

  exitPanelEditor() {
    this.panelInEdit!.destroy();
    this.panelInEdit = undefined;
  }

  private ensurePanelsHaveIds() {
    let nextPanelId = this.getNextPanelId();
    for (const panel of this.panels) {
      panel.id ??= nextPanelId++;
    }
  }

  private ensureListExist(data: any = {}) {
    data.list ??= [];
    return data;
  }

  getNextPanelId() {
    let max = 0;

    for (const panel of this.panels) {
      if (panel.id > max) {
        max = panel.id;
      }
    }

    return max + 1;
  }

  forEachPanel(callback: (panel: PanelModel, index: number) => void) {
    for (let i = 0; i < this.panels.length; i++) {
      callback(this.panels[i], i);
    }
  }

  getPanelById(id: number): PanelModel | null {
    if (this.panelInEdit && this.panelInEdit.id === id) {
      return this.panelInEdit;
    }

    return this.panels.find((p) => p.id === id) ?? null;
  }

  canEditPanel(panel?: PanelModel | null): boolean | undefined | null {
    return Boolean(this.meta.canEdit && panel && panel.type !== 'row');
  }

  canEditPanelById(id: number): boolean | undefined | null {
    return this.canEditPanel(this.getPanelById(id));
  }

  addPanel(panelData: any) {
    panelData.id = this.getNextPanelId();

    this.panels.unshift(new PanelModel(panelData));

    this.sortPanelsByGridPos();

    this.events.publish(new DashboardPanelsChangedEvent());
  }

  updateMeta(updates: Partial<DashboardMeta>) {
    this.meta = { ...this.meta, ...updates };
    this.events.publish(new DashboardMetaChangedEvent());
  }

  sortPanelsByGridPos() {
    this.panels.sort((panelA, panelB) => {
      if (panelA.gridPos.y === panelB.gridPos.y) {
        return panelA.gridPos.x - panelB.gridPos.x;
      } else {
        return panelA.gridPos.y - panelB.gridPos.y;
      }
    });
  }

  clearUnsavedChanges() {
    for (const panel of this.panels) {
      panel.configRev = 0;
    }

    if (this.panelInEdit) {
      // Remember that we have a saved a change in panel editor so we apply it when leaving panel edit
      this.panelInEdit.hasSavedPanelEditChange = this.panelInEdit.configRev > 0;
      this.panelInEdit.configRev = 0;
    }
  }

  hasUnsavedChanges() {
    const changedPanel = this.panels.find((p) => p.hasChanged);
    return Boolean(changedPanel);
  }

  getRowHeight(rowPanel: PanelModel): number {
    if (!rowPanel.panels || rowPanel.panels.length === 0) {
      return 0;
    }

    const rowYPos = rowPanel.gridPos.y;
    const positions = map(rowPanel.panels, 'gridPos');
    const maxPos = maxBy(positions, (pos: GridPos) => pos.y + pos.h);
    return maxPos!.y + maxPos!.h - rowYPos;
  }

  removePanel(panel: PanelModel) {
    this.panels = this.panels.filter((item) => item !== panel);
    this.events.publish(new DashboardPanelsChangedEvent());
  }

  getPanelInfoById(panelId: number) {
    const panelIndex = this.panels.findIndex((p) => p.id === panelId);
    return panelIndex >= 0 ? { panel: this.panels[panelIndex], index: panelIndex } : null;
  }

  duplicatePanel(panel: PanelModel) {
    const newPanel = panel.getSaveModel();
    newPanel.id = this.getNextPanelId();

    // does it fit to the right?
    if (panel.gridPos.x + panel.gridPos.w * 2 <= GRID_COLUMN_COUNT) {
      newPanel.gridPos.x += panel.gridPos.w;
    } else {
      // add below
      newPanel.gridPos.y += panel.gridPos.h;
    }

    this.addPanel(newPanel);
    return newPanel;
  }

  formatDate(date: DateTimeInput, format?: string) {
    return dateTimeFormat(date, {
      format,
      timeZone: contextSrv?.user?.timezone,
    });
  }

  destroy() {
    this.appEventsSubscription.unsubscribe();
    this.events.removeAllListeners();
    for (const panel of this.panels) {
      panel.destroy();
    }
  }

  /**
   * Will return all panels after rowIndex until it encounters another row
   */
  getRowPanels(rowIndex: number): PanelModel[] {
    const panelsBelowRow = this.panels.slice(rowIndex + 1);
    const nextRowIndex = panelsBelowRow.findIndex((p) => p.type === 'row');

    // Take all panels up to next row, or all panels if there are no other rows
    const rowPanels = panelsBelowRow.slice(0, nextRowIndex >= 0 ? nextRowIndex : this.panels.length);

    return rowPanels;
  }

  /** @deprecated */
  on<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
    console.log('DashboardModel.on is deprecated use events.subscribe');
    this.events.on(event, callback);
  }

  /** @deprecated */
  off<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
    console.log('DashboardModel.off is deprecated');
    this.events.off(event, callback);
  }

  getRelativeTime(date: DateTimeInput) {
    return dateTimeFormatTimeAgo(date, {
      timeZone: contextSrv?.user?.timezone,
    });
  }

  private updateSchema(old: any) {
    const migrator = new DashboardMigrator(this);
    migrator.updateSchema(old);
  }

  autoFitPanels(viewHeight: number) {
    const currentGridHeight = Math.max(...this.panels.map((panel) => panel.gridPos.h + panel.gridPos.y));

    const navbarHeight = 55;
    const margin = 20;
    const submenuHeight = 50;

    let visibleHeight = viewHeight - navbarHeight - margin;

    // Remove submenu height if visible
    if (this.meta.submenuEnabled) {
      visibleHeight -= submenuHeight;
    }

    // add back navbar height

    const visibleGridHeight = Math.floor(visibleHeight / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
    const scaleFactor = currentGridHeight / visibleGridHeight;

    for (const panel of this.panels) {
      panel.gridPos.y = Math.round(panel.gridPos.y / scaleFactor) || 1;
      panel.gridPos.h = Math.round(panel.gridPos.h / scaleFactor) || 1;
    }
  }

  getPanelByUrlId(panelUrlId: string) {
    const panelId = parseInt(panelUrlId ?? '0', 10);
    return this.getPanelById(panelId);
  }

  canEditDashboard() {
    return Boolean(this.meta.canEdit);
  }

  shouldUpdateDashboardPanelFromJSON(updatedPanel: PanelModel, panel: PanelModel) {
    const shouldUpdateGridPositionLayout = !isEqual(updatedPanel?.gridPos, panel?.gridPos);
    if (shouldUpdateGridPositionLayout) {
      this.events.publish(new DashboardPanelsChangedEvent());
    }
  }
}
