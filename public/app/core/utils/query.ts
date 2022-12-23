export function isDataQuery(url: string): boolean {
  if (url.indexOf('api/datasources/proxy') !== -1 || url.indexOf('api/ds/query') !== -1) {
    return true;
  }

  return false;
}

export function isLocalUrl(url: string) {
  return !url.match(/^http/);
}
