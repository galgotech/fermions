import { config } from 'app/core/config';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}
