import { DataFrameView } from '../dataframe/DataFrameView';
import { GrafanaTheme2 } from '../themes';
import {
  DataFrame,
  DisplayValue,
  DisplayValueAlignmentFactors,
  Field,
  FieldConfig,
  FieldConfigSource,
  LinkModel,
  TimeRange,
  TimeZone,
} from '../types';

/**
 * Options for how to turn DataFrames into an array of display values
 */
export interface ReduceDataOptions {
  /* If true show each row value */
  values?: boolean;
  /** if showing all values limit */
  limit?: number;
  /** When !values, pick one value for the whole field */
  calcs: string[];
  /** Which fields to show.  By default this is only numeric fields */
  fields?: string;
}

// TODO: use built in variables, same as for data links?
export const VAR_SERIES_NAME = '__series.name';
export const VAR_FIELD_NAME = '__field.displayName'; // Includes the rendered tags and naming strategy
export const VAR_FIELD_LABELS = '__field.labels';
export const VAR_CALC = '__calc';
export const VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates

export interface FieldSparkline {
  y: Field; // Y values
  x?: Field; // if this does not exist, use the index
  timeRange?: TimeRange; // Optionally force an absolute time
  highlightIndex?: number;
}

export interface FieldDisplay {
  name: string; // The field name (title is in display)
  field: FieldConfig;
  display: DisplayValue;
  sparkline?: FieldSparkline;

  // Expose to the original values for delayed inspection (DataLinks etc)
  view?: DataFrameView;
  colIndex?: number; // The field column index
  rowIndex?: number; // only filled in when the value is from a row (ie, not a reduction)
  getLinks?: () => LinkModel[];
  hasLinks: boolean;
}

export interface GetFieldDisplayValuesOptions {
  data?: DataFrame[];
  reduceOptions: ReduceDataOptions;
  fieldConfig: FieldConfigSource;
  sparkline?: boolean; // Calculate the sparkline
  theme: GrafanaTheme2;
  timeZone?: TimeZone;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export function hasLinks(field: Field): boolean {
  return field.config?.links?.length ? field.config.links.length > 0 : false;
}

export function getDisplayValueAlignmentFactors(values: FieldDisplay[]): DisplayValueAlignmentFactors {
  const info: DisplayValueAlignmentFactors = {
    title: '',
    text: '',
  };

  let prefixLength = 0;
  let suffixLength = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i].display;

    if (v.text && v.text.length > info.text.length) {
      info.text = v.text;
    }

    if (v.title && v.title.length > info.title.length) {
      info.title = v.title;
    }

    if (v.prefix && v.prefix.length > prefixLength) {
      info.prefix = v.prefix;
      prefixLength = v.prefix.length;
    }

    if (v.suffix && v.suffix.length > suffixLength) {
      info.suffix = v.suffix;
      suffixLength = v.suffix.length;
    }
  }
  return info;
}
