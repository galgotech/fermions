import { NavLinkDTO } from '@grafana/data';

export function pluginHasRootPage(pluginId: string, navTree: NavLinkDTO[]): boolean {
  return Boolean(
    navTree
      .find((navLink) => navLink.id === 'apps')
      ?.children?.find((app) => app.id === `plugin-page-${pluginId}`)
      ?.children?.some((page) => page.url?.endsWith(`/a/${pluginId}`))
  );
}
