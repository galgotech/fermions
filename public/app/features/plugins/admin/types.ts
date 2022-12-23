import { EntityState } from '@reduxjs/toolkit';

import {
  PluginType,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginDependencies,
  PluginErrorCode,
  WithAccessControlMetadata,
} from '@grafana/data';
import { PluginsState } from 'app/types';

export type PluginTypeCode = 'app' | 'panel' | 'datasource';

export enum PluginListDisplayMode {
  Grid = 'grid',
  List = 'list',
}

export enum PluginIconName {
  app = 'apps',
  datasource = 'database',
  panel = 'credit-card',
  renderer = 'capture',
  secretsmanager = 'key-skeleton-alt',
}

export interface CatalogPlugin extends WithAccessControlMetadata {
  description: string;
  downloads: number;
  hasUpdate: boolean;
  id: string;
  info: CatalogPluginInfo;
  isDev: boolean;
  isCore: boolean;
  isEnterprise: boolean;
  isInstalled: boolean;
  isDisabled: boolean;
  // `isPublished` is TRUE if the plugin is published to grafana.com
  isPublished: boolean;
  name: string;
  orgName: string;
  signature: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
  popularity: number;
  publishedAt: string;
  type?: PluginType;
  updatedAt: string;
  installedVersion?: string;
  details?: CatalogPluginDetails;
  error?: PluginErrorCode;
}

export interface CatalogPluginDetails {
  readme?: string;
  versions?: Version[];
  links: Array<{
    name: string;
    url: string;
  }>;
  grafanaDependency?: string;
  pluginDependencies?: PluginDependencies['plugins'];
}

export interface CatalogPluginInfo {
  logos: {
    large: string;
    small: string;
  };
}

export interface Build {
  time?: number;
  repo?: string;
  branch?: string;
  hash?: string;
}

export interface Version {
  version: string;
  createdAt: string;
  isCompatible: boolean;
  grafanaDependency: string | null;
}

export interface Org {
  slug: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  avatar: string;
  avatarUrl: string;
}

export enum RequestStatus {
  Pending = 'Pending',
  Fulfilled = 'Fulfilled',
  Rejected = 'Rejected',
}

export type RequestInfo = {
  status: RequestStatus;
  // The whole error object
  error?: any;
  // An optional error message
  errorMessage?: string;
};

// TODO<remove `PluginsState &` when the "plugin_admin_enabled" feature flag is removed>
export type ReducerState = PluginsState & {
  items: EntityState<CatalogPlugin>;
  requests: Record<string, RequestInfo>;
  settings: {
    displayMode: PluginListDisplayMode;
  };
};

