export type DeleteDashboardResponse = {
  id: number;
  message: string;
  title: string;
};

export interface ListPublicDashboardResponse {
  uid: string;
  accessToken: string;
  dashboardUid: string;
  title: string;
  isEnabled: boolean;
}
