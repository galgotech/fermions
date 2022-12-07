import {
  DataFrame,
  DataLink,
  deprecationWarning,
  Field,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  LinkModel,
  locationUtil,
  textUtil,
  urlUtil,
  VariableOrigin,
  VariableSuggestion,
} from '@grafana/data';
import { getConfig } from 'app/core/config';

const buildLabelPath = (label: string) => {
  return label.includes('.') || label.trim().includes(' ') ? `["${label}"]` : `.${label}`;
};

export const getDataFrameVars = (dataFrames: DataFrame[]) => {
  let numeric: Field | undefined = undefined;
  let title: Field | undefined = undefined;
  const suggestions: VariableSuggestion[] = [];
  const keys: KeyValue<true> = {};

  if (dataFrames.length !== 1) {
    // It's not possible to access fields of other dataframes. So if there are multiple dataframes we need to skip these suggestions.
    // Also return early if there are no dataFrames.
    return [];
  }

  const frame = dataFrames[0];

  for (const field of frame.fields) {
    const displayName = getFieldDisplayName(field, frame, dataFrames);

    if (keys[displayName]) {
      continue;
    }

    suggestions.push({
      value: `__data.fields${buildLabelPath(displayName)}`,
      label: `${displayName}`,
      documentation: `Formatted value for ${displayName} on the same row`,
      origin: VariableOrigin.Fields,
    });

    keys[displayName] = true;

    if (!numeric && field.type === FieldType.number) {
      numeric = { ...field, name: displayName };
    }

    if (!title && field.config.displayName && field.config.displayName !== field.name) {
      title = { ...field, name: displayName };
    }
  }

  if (suggestions.length) {
    suggestions.push({
      value: `__data.fields[0]`,
      label: `Select by index`,
      documentation: `Enter the field order`,
      origin: VariableOrigin.Fields,
    });
  }

  if (numeric) {
    suggestions.push({
      value: `__data.fields${buildLabelPath(numeric.name)}.numeric`,
      label: `Show numeric value`,
      documentation: `the numeric field value`,
      origin: VariableOrigin.Fields,
    });
    suggestions.push({
      value: `__data.fields${buildLabelPath(numeric.name)}.text`,
      label: `Show text value`,
      documentation: `the text value`,
      origin: VariableOrigin.Fields,
    });
  }

  if (title) {
    suggestions.push({
      value: `__data.fields${buildLabelPath(title.name)}`,
      label: `Select by title`,
      documentation: `Use the title to pick the field`,
      origin: VariableOrigin.Fields,
    });
  }

  return suggestions;
};

export interface LinkService {
  getDataLinkUIModel: <T>(link: DataLink, origin: T) => LinkModel<T>;
  getAnchorInfo: (link: any) => any;
  getLinkUrl: (link: any) => string;
}

export class LinkSrv implements LinkService {
  getLinkUrl(link: any) {
    let url = locationUtil.assureBaseUrl(link.url);
    let params: { [key: string]: any } = {};

    url = urlUtil.appendQueryToUrl(url, urlUtil.toUrlParams(params));
    return getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
  }

  getAnchorInfo(link: any) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = link.title;
    info.tooltip = link.tooltip;
    return info;
  }

  /**
   * Returns LinkModel which is basically a DataLink with all values interpolated through the templateSrv.
   */
  getDataLinkUIModel = <T>(
    link: DataLink,
    origin: T
  ): LinkModel<T> => {
    let href = link.url;

    if (link.onBuildUrl) {
      href = link.onBuildUrl({
        origin,
      });
    }

    const info: LinkModel<T> = {
      href: locationUtil.assureBaseUrl(href.replace(/\n/g, '')),
      title: link.title ?? '',
      target: link.targetBlank ? '_blank' : undefined,
      origin,
    };



    if (link.onClick) {
      info.onClick = (e) => {
        link.onClick!({
          origin,
          e,
        });
      };
    }

    info.href = getConfig().disableSanitizeHtml ? info.href : textUtil.sanitizeUrl(info.href);

    return info;
  };

  /**
   * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
   *
   * @deprecated Drilldown links should be generated using getDataLinkUIModel method
   */
  getPanelLinkAnchorInfo(link: DataLink) {
    deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
    return this.getDataLinkUIModel(link, {});
  }
}

let singleton: LinkService | undefined;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  if (!singleton) {
    singleton = new LinkSrv();
  }
  return singleton;
}
