import { WorkflowValidator, ValidationError, Specification } from '@severlessworkflow/sdk-typescript';
import { cloneDeep, defaultsDeep, isEqual, keys } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import {
  DataConfigSource,
  DataQuery,
  EventBusSrv,
  FieldConfigSource,
  PanelPlugin,
  PanelModel as IPanelModel,
} from '@grafana/data';
import config from 'app/core/config';
import { safeStringifyValue } from 'app/core/utils/explore';
import { SavedQueryLink } from 'app/features/query-library/types';
import { PanelWorkflowRunner } from 'app/features/workflow/state/PanelWorkflowRunner';
import { WorkflowOptions } from 'app/types';
import {
  PanelOptionsChangedEvent,
  PanelQueriesChangedEvent,
  WorkflowEvent,
} from 'app/types/events';

import { LibraryElementDTO, LibraryPanelRef } from '../../library-panels/types';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';

import {
  filterFieldConfigOverrides,
  getPanelOptionsWithDefaults,
  isStandardFieldProp,
  restoreCustomOverrideRules,
} from './getPanelOptionsWithDefaults';

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

const notPersistedProperties: { [str: string]: boolean } = {
  events: true,
  isViewing: true,
  isEditing: true,
  isInView: true,
  cachedPluginOptions: true,
  plugin: true,
  queryRunner: true,
  configRev: true,
  hasSavedPanelEditChange: true,
  key: true,
};

// For angular panels we need to clean up properties when changing type
// To make sure the change happens without strange bugs happening when panels use same
// named property with different type / value expectations
// This is not required for react panels
const mustKeepProps: { [str: string]: boolean } = {
  gridPos: true,
  type: true,
  minSpan: true,
  panels: true,
  targets: true,
  isEditing: true,
  events: true,
  cacheTimeout: true,
  cachedPluginOptions: true,
  pluginVersion: true,
  queryRunner: true,
  fieldConfig: true,
  libraryPanel: true,
  configRev: true,
  key: true,
  workflow: true,
};

const defaults: any = {
  gridPos: { x: 0, y: 0, h: 3, w: 6 },
  targets: [{ refId: 'A' }],
  cachedPluginOptions: {},
  options: {},
  fieldConfig: {
    defaults: {},
    overrides: [],
  },
  savedQueryLink: null,
  workflow: {
    id: "",
    version: "1.0",
    specVersion: "0.8",
    name: "",
    description: "",
    start: "start",
    functions: [
      {
        name: "start",
        operation: "http://fhub.dev/start"
      }
    ],
    states: [
      {
        name: "start",
        type: "operation",
        actions:
        [
          {
            functionRef: "start"
          }
        ],
        end: {
          terminate: true,
          produceEvents:
          [
            {
              eventRef: "PanelState"
            }
          ]
        }
      }
    ]
  },
};

export class PanelModel implements DataConfigSource, IPanelModel {
  /* persisted id, used in URL to identify a panel */
  gridPos!: GridPos;
  type!: string;
  workflow!: Specification.Workflow;

  panels?: PanelModel[];
  declare targets: DataQuery[];
  pluginVersion?: string;
  savedQueryLink: SavedQueryLink | null = null; // Used by the experimental feature queryLibrary

  declare options: {
    [key: string]: any;
  };
  declare fieldConfig: FieldConfigSource;

  libraryPanel?: LibraryPanelRef | LibraryElementDTO;

  autoMigrateFrom?: string;

  // non persisted
  isViewing = false;
  isEditing = false;
  isInView = false;
  configRev = 0; // increments when configs change
  hasSavedPanelEditChange?: boolean;
  cacheTimeout?: string | null;
  cachedPluginOptions: Record<string, PanelOptionsCache> = {};
  plugin?: PanelPlugin;
  /**
   * Unique in application state, this is used as redux key for panel and for redux panel state
   * Change will cause unmount and re-init of panel
   */
  key: string;

  /**
   * The PanelModel event bus only used for internal and legacy angular support.
   * The EventBus passed to panels is based on the dashboard event model.
   */
  events: EventBusSrv;

  private queryRunner?: PanelQueryRunner;

  constructor(model: any) {
    this.events = new EventBusSrv();
    this.restoreModel(model);
    this.key = uuidv4();
  }

  /** Given a persistened PanelModel restores property values */
  restoreModel(model: any) {
    // Start with clean-up
    for (const property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      if (model[property]) {
        continue;
      }

      if (typeof (this as any)[property] === 'function') {
        continue;
      }

      if (typeof (this as any)[property] === 'symbol') {
        continue;
      }

      delete (this as any)[property];
    }

    // defaults
    defaultsDeep(this, cloneDeep(defaults));

    // copy properties from persisted model
    for (const property in model) {
      (this as any)[property] = model[property];
    }
  }

  generateNewKey() {
    this.key = uuidv4();
  }

  getOptions() {
    return this.options;
  }

  get hasChanged(): boolean {
    return this.configRev > 0;
  }

  updateOptions(options: object) {
    this.options = options;
    this.configRev++;
    this.events.publish(new PanelOptionsChangedEvent());
    this.render();
  }

  getSaveModel() {
    const model: any = {};

    for (const property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      if (isEqual(this[property], defaults[property])) {
        continue;
      }

      model[property] = cloneDeep(this[property]);
    }

    return model;
  }

  setIsViewing(isViewing: boolean) {
    this.isViewing = isViewing;
  }

  updateGridPos(newPos: GridPos, manuallyUpdated = true) {
    if (
      newPos.x === this.gridPos.x &&
      newPos.y === this.gridPos.y &&
      newPos.h === this.gridPos.h &&
      newPos.w === this.gridPos.w
    ) {
      return;
    }

    this.gridPos.x = newPos.x;
    this.gridPos.y = newPos.y;
    this.gridPos.w = newPos.w;
    this.gridPos.h = newPos.h;
    if (manuallyUpdated) {
      this.configRev++;
    }
  }

  render() {
    this.events.publish(new WorkflowEvent());
  }

  private getOptionsToRemember() {
    return Object.keys(this).reduce((acc, property) => {
      if (notPersistedProperties[property] || mustKeepProps[property]) {
        return acc;
      }
      return {
        ...acc,
        [property]: (this as any)[property],
      };
    }, {});
  }

  private restorePanelOptions(pluginId: string) {
    const prevOptions = this.cachedPluginOptions[pluginId];

    if (!prevOptions) {
      return;
    }

    Object.keys(prevOptions.properties).map((property) => {
      (this as any)[property] = prevOptions.properties[property];
    });

    this.fieldConfig = restoreCustomOverrideRules(this.fieldConfig, prevOptions.fieldConfig);
  }

  applyPluginOptionDefaults(plugin: PanelPlugin, isAfterPluginChange: boolean) {
    const options = getPanelOptionsWithDefaults({
      plugin,
      currentOptions: this.options,
      currentFieldConfig: this.fieldConfig,
      isAfterPluginChange: isAfterPluginChange,
    });

    this.fieldConfig = options.fieldConfig;
    this.options = options.options;
  }

  pluginLoaded(plugin: PanelPlugin) {
    this.plugin = plugin;
    const version = getPluginVersion(plugin);

    if (this.autoMigrateFrom) {
      this.callPanelTypeChangeHandler(
        plugin,
        this.autoMigrateFrom,
        this.getOptionsToRemember(), // old options
      );

      delete this.autoMigrateFrom;
    }

    if (plugin.onPanelMigration) {
      if (version !== this.pluginVersion) {
        this.options = plugin.onPanelMigration(this);
        this.pluginVersion = version;
      }
    }

    this.applyPluginOptionDefaults(plugin, false);
    this.resendLastResult();
  }

  clearPropertiesBeforePluginChange() {
    // remove panel type specific  options
    for (const key of keys(this)) {
      if (mustKeepProps[key]) {
        continue;
      }
      delete (this as any)[key];
    }

    this.options = {};

    // clear custom options
    this.fieldConfig = {
      defaults: {
        ...this.fieldConfig.defaults,
        custom: {},
      },
      // filter out custom overrides
      overrides: filterFieldConfigOverrides(this.fieldConfig.overrides, isStandardFieldProp),
    };
  }

  // Let panel plugins inspect options from previous panel and keep any that it can use
  private callPanelTypeChangeHandler(
    newPlugin: PanelPlugin,
    oldPluginId: string,
    oldOptions: any,
  ) {
    if (newPlugin.onPanelTypeChanged) {
      const prevOptions = oldOptions.options;
      Object.assign(this.options, newPlugin.onPanelTypeChanged(this, oldPluginId, prevOptions, this.fieldConfig));
    }
  }

  changePlugin(newPlugin: PanelPlugin) {
    const pluginId = newPlugin.meta.id;
    const oldOptions: any = this.getOptionsToRemember();
    const prevFieldConfig = this.fieldConfig;
    const oldPluginId = this.type;
    this.cachedPluginOptions[oldPluginId] = {
      properties: oldOptions,
      fieldConfig: prevFieldConfig,
    };

    this.clearPropertiesBeforePluginChange();
    this.restorePanelOptions(pluginId);

    // Potentially modify current options
    this.callPanelTypeChangeHandler(newPlugin, oldPluginId, oldOptions);

    // switch
    this.type = pluginId;
    this.plugin = newPlugin;
    this.configRev++;

    this.applyPluginOptionDefaults(newPlugin, true);

    if (newPlugin.onPanelMigration) {
      this.pluginVersion = getPluginVersion(newPlugin);
    }
  }

  updateQueries(options: WorkflowOptions) {
    if (options.savedQueryUid) {
      this.savedQueryLink = {
        ref: {
          uid: options.savedQueryUid,
        },
      };
    } else {
      this.savedQueryLink = null;
    }

    this.setWorkflowText(options.workflow);
    this.cacheTimeout = options.cacheTimeout;
    this.configRev++;

    this.events.publish(new PanelQueriesChangedEvent());
  }

  getEditClone() {
    const sourceModel = this.getSaveModel();

    const clone = new PanelModel(sourceModel);
    clone.isEditing = true;
    clone.plugin = this.plugin;

    const sourceQueryRunner = this.getQueryRunner();

    // Copy last query result
    clone.getQueryRunner().useLastResultFrom(sourceQueryRunner);

    return clone;
  }

  getQueryRunner(): PanelQueryRunner {
    if (!this.queryRunner) {
      this.queryRunner = new PanelQueryRunner();
    }
    return this.queryRunner;
  }

  hasTitle() {
    const title = this.title;
    return this.title && title.length > 0;
  }

  destroy() {
    this.events.removeAllListeners();

    if (this.queryRunner) {
      this.queryRunner.destroy();
    }
  }

  setProperty(key: keyof this, value: any) {
    this[key] = value;
    this.configRev++;
  }

  resendLastResult() {
    if (!this.plugin) {
      return;
    }

    this.getQueryRunner().resendLastResult();
  }

  initLibraryPanel(libPanel: LibraryElementDTO) {
    for (const [key, val] of Object.entries(libPanel.model)) {
      switch (key) {
        case 'id':
        case 'gridPos':
        case 'libraryPanel': // recursive?
          continue;
      }
      (this as any)[key] = val; // :grimmice:
    }
    this.libraryPanel = libPanel;
  }

  unlinkLibraryPanel() {
    delete this.libraryPanel;
    this.configRev++;
    this.render();
  }

  set id(value: number) {
    this.workflow.id = String(value);
  }

  get id(): number {
    return parseInt(this.workflow.id!, 10);
  }

  set title(value: string) {
    this.workflow.name = value;
  }

  get title(): string {
    return this.workflow.name || "";
  }

  set description(value: string) {
    this.workflow.description = value;
  }

  get description(): string {
    return this.workflow.description || "";
  }

  runWorkflow() {
    const workflow = new Specification.Workflow(this.workflow);
    const workflowValidator = new WorkflowValidator(workflow);
    if (!workflowValidator.isValid) {
        workflowValidator.errors.forEach(error => console.error((error as ValidationError).message));
        throw Error("Invalid workflow");
    }

    const runner = new PanelWorkflowRunner(workflow, this.events);
    runner.start();
  }

  getWorkflowText(): string {
    return JSON.stringify(this.workflow, undefined, 2);
  }

  setWorkflowText(workflow: string) {
    this.workflow = JSON.parse(workflow);
  }
}

function getPluginVersion(plugin: PanelPlugin): string {
  return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}

interface PanelOptionsCache {
  properties: any;
  fieldConfig: FieldConfigSource;
}

// For cases where we immediately want to stringify the panel model without cloning each property
export function stringifyPanelModel(panel: PanelModel) {
  const model: any = {};

  Object.entries(panel)
    .filter(
      ([prop, val]) => !notPersistedProperties[prop] && panel.hasOwnProperty(prop) && !isEqual(val, defaults[prop])
    )
    .forEach(([k, v]) => {
      model[k] = v;
    });

  return safeStringifyValue(model);
}
