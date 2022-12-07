import {
  DataLink,
  DataQuery,
  ExplorePanelsState,
  Field,
  InternalDataLink,
  LinkModel,
  SplitOpen,
  TimeRange,
} from '../types';

import { locationUtil } from './location';
import { serializeStateToUrlParam } from './url';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  timeRangeFrom: '__from',
  timeRangeTo: '__to',
  includeVars: '__all_variables',
  seriesName: '__series.name',
  fieldName: '__field.name',
  valueTime: '__value.time',
  valueNumeric: '__value.numeric',
  valueText: '__value.text',
  valueRaw: '__value.raw',
  // name of the calculation represented by the value
  valueCalc: '__value.calc',
};

// We inject these because we cannot import them directly as they reside inside grafana main package.
export type LinkToExploreOptions = {
  link: DataLink;
  range: TimeRange;
  field: Field;
  internalLink: InternalDataLink;
  onClickFn?: SplitOpen;
};

export function mapInternalLinkToExplore(options: LinkToExploreOptions): LinkModel<Field> {
  const { onClickFn, link, range, field, internalLink } = options;

  const interpolatedQuery = link.internal?.query;
  const interpolatedPanelsState = link.internal?.panelsState;
  const title = link.title ? link.title : internalLink.datasourceName;

  return {
    title: title,
    // In this case this is meant to be internal link (opens split view by default) the href will also points
    // to explore but this way you can open it in new tab.
    href: generateInternalHref(internalLink.datasourceUid, interpolatedQuery, range, interpolatedPanelsState),
    onClick: onClickFn
      ? () => {
          onClickFn({
            datasourceUid: internalLink.datasourceUid,
            query: interpolatedQuery,
            panelsState: interpolatedPanelsState,
            range,
          });
        }
      : undefined,
    target: '_self',
    origin: field,
  };
}

/**
 * Generates href for internal derived field link.
 */
function generateInternalHref<T extends DataQuery = any>(
  datasourceUid: string,
  query: T,
  range: TimeRange,
  panelsState?: ExplorePanelsState
): string {
  return locationUtil.assureBaseUrl(
    `/explore?left=${encodeURIComponent(
      serializeStateToUrlParam({
        range: range.raw,
        datasource: datasourceUid,
        queries: [query],
        panelsState: panelsState,
      })
    )}`
  );
}
