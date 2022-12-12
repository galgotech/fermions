import React, { useState, useMemo, useEffect } from 'react';

import {
  FieldConfigSource,
  PanelPlugin,
  PluginContextProvider,
} from '@grafana/data';
import { PanelRendererProps } from '@grafana/runtime';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { appEvents } from 'app/core/core';

import { getPanelOptionsWithDefaults, OptionDefaults } from '../../dashboard/state/getPanelOptionsWithDefaults';
import { importPanelPlugin, syncGetPanelPlugin } from '../../plugins/importPanelPlugin';

const defaultFieldConfig = { defaults: {}, overrides: [] };

export function PanelRenderer<P extends object = any, F extends object = any>(props: PanelRendererProps<P, F>) {
  const {
    pluginId,
    data,
    options = {},
    width,
    height,
    title,
    onOptionsChange = () => {},
    fieldConfig = defaultFieldConfig,
  } = props;

  const [plugin, setPlugin] = useState(syncGetPanelPlugin(pluginId));
  const [error, setError] = useState<string | undefined>();
  const optionsWithDefaults = useOptionDefaults(plugin, options, fieldConfig);
  const dataWithOverrides = data;

  useEffect(() => {
    // If we already have a plugin and it's correct one do nothing
    if (plugin && plugin.hasPluginId(pluginId)) {
      return;
    }

    // Async load the plugin
    importPanelPlugin(pluginId)
      .then((result) => setPlugin(result))
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [pluginId, plugin]);

  if (error) {
    return <div>Failed to load plugin: {error}</div>;
  }

  if (!plugin || !plugin.hasPluginId(pluginId)) {
    return <div>Loading plugin panel...</div>;
  }

  if (!plugin.panel) {
    return <div>Seems like the plugin you are trying to load does not have a panel component.</div>;
  }

  if (!dataWithOverrides) {
    return <div>No panel data</div>;
  }

  const PanelComponent = plugin.panel;

  return (
    <ErrorBoundaryAlert dependencies={[plugin, data]}>
      <PluginContextProvider meta={plugin.meta}>
        <PanelComponent
          id={1}
          data={dataWithOverrides}
          title={title}
          options={optionsWithDefaults!.options}
          width={width}
          height={height}
          renderCounter={0}
          onOptionsChange={onOptionsChange}
          eventBus={appEvents}
        />
      </PluginContextProvider>
    </ErrorBoundaryAlert>
  );
}

function useOptionDefaults<P extends object = any, F extends object = any>(
  plugin: PanelPlugin | undefined,
  options: P,
  fieldConfig: FieldConfigSource<F>
): OptionDefaults | undefined {
  return useMemo(() => {
    if (!plugin) {
      return;
    }

    return getPanelOptionsWithDefaults({
      plugin,
      currentOptions: options,
      currentFieldConfig: fieldConfig,
      isAfterPluginChange: false,
    });
  }, [plugin, fieldConfig, options]);
}
