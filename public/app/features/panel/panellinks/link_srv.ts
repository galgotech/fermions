import {
  DataLink,
  deprecationWarning,
  LinkModel,
  locationUtil,
  textUtil,
  urlUtil,
} from '@grafana/data';
import { getConfig } from 'app/core/config';

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
