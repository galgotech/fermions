import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  KeyValue,
  DataSourceSettings,
  DataSourceJsonData,
} from '../types';

export const onUpdateDatasourceOption =
  (props: DataSourcePluginOptionsEditorProps, key: keyof DataSourceSettings) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateDatasourcePluginOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceJsonDataOption =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceSecureJsonDataOption =
  <J extends DataSourceJsonData, S extends {} = KeyValue>(
    props: DataSourcePluginOptionsEditorProps<J, S>,
    key: string
  ) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    updateDatasourcePluginSecureJsonDataOption(props, key, event.currentTarget.value);
  };

export const onUpdateDatasourceJsonDataOptionSelect =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (selected: SelectableValue) => {
    updateDatasourcePluginJsonDataOption(props, key, selected.value);
  };

export const onUpdateDatasourceJsonDataOptionChecked =
  <J extends DataSourceJsonData, S, K extends keyof J>(props: DataSourcePluginOptionsEditorProps<J, S>, key: K) =>
  (event: React.SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.checked);
  };

export const onUpdateDatasourceSecureJsonDataOptionSelect =
  <J extends DataSourceJsonData, S extends {} = KeyValue>(
    props: DataSourcePluginOptionsEditorProps<J, S>,
    key: string
  ) =>
  (selected: SelectableValue) => {
    updateDatasourcePluginSecureJsonDataOption(props, key, selected.value);
  };

export const onUpdateDatasourceResetOption =
  (props: DataSourcePluginOptionsEditorProps, key: string) =>
  (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    updateDatasourcePluginResetOption(props, key);
  };

export function updateDatasourcePluginOption<J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: keyof DataSourceSettings,
  val: any
) {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    [key]: val,
  });
}

export const updateDatasourcePluginJsonDataOption = <J extends DataSourceJsonData, S, K extends keyof J>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: K,
  val: any
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    jsonData: {
      ...config.jsonData,
      [key]: val,
    },
  });
};

export const updateDatasourcePluginSecureJsonDataOption = <J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string,
  val: any
) => {
  const config = props.options;

  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...(config.secureJsonData ? config.secureJsonData : ({} as S)),
      [key]: val,
    },
  });
};

export const updateDatasourcePluginResetOption = <J extends DataSourceJsonData, S extends {} = KeyValue>(
  props: DataSourcePluginOptionsEditorProps<J, S>,
  key: string
) => {
  const config = props.options;
  props.onOptionsChange({
    ...config,
    secureJsonData: {
      ...(config.secureJsonData ? config.secureJsonData : ({} as S)),
      [key]: '',
    },
    secureJsonFields: {
      ...config.secureJsonFields,
      [key]: false,
    },
  });
};
