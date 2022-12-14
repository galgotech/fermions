package models

type SystemStats struct {
	Dashboards                int64
	Users                     int64
	ActiveUsers               int64
	DailyActiveUsers          int64
	MonthlyActiveUsers        int64
	Orgs                      int64
	Stars                     int64
	Teams                     int64
	DashboardPermissions      int64
	FolderPermissions         int64
	Folders                   int64
	ProvisionedDashboards     int64
	AuthTokens                int64
	APIKeys                   int64 `xorm:"api_keys"`
	DashboardVersions         int64
	LibraryPanels             int64
	LibraryVariables          int64
	DashboardsViewersCanEdit  int64
	DashboardsViewersCanAdmin int64
	FoldersViewersCanEdit     int64
	FoldersViewersCanAdmin    int64
	Admins                    int64
	Editors                   int64
	Viewers                   int64
	ActiveAdmins              int64
	ActiveEditors             int64
	ActiveViewers             int64
	ActiveSessions            int64
	DailyActiveAdmins         int64
	DailyActiveEditors        int64
	DailyActiveViewers        int64
	DailyActiveSessions       int64
	DataKeys                  int64
	ActiveDataKeys            int64
}

type GetSystemStatsQuery struct {
	Result *SystemStats
}

type AdminStats struct {
	Orgs                int64 `json:"orgs"`
	Dashboards          int64 `json:"dashboards"`
	Tags                int64 `json:"tags"`
	Stars               int64 `json:"stars"`
	Users               int64 `json:"users"`
	Admins              int64 `json:"admins"`
	Editors             int64 `json:"editors"`
	Viewers             int64 `json:"viewers"`
	ActiveUsers         int64 `json:"activeUsers"`
	ActiveAdmins        int64 `json:"activeAdmins"`
	ActiveEditors       int64 `json:"activeEditors"`
	ActiveViewers       int64 `json:"activeViewers"`
	ActiveSessions      int64 `json:"activeSessions"`
	DailyActiveUsers    int64 `json:"dailyActiveUsers"`
	DailyActiveAdmins   int64 `json:"dailyActiveAdmins"`
	DailyActiveEditors  int64 `json:"dailyActiveEditors"`
	DailyActiveViewers  int64 `json:"dailyActiveViewers"`
	DailyActiveSessions int64 `json:"dailyActiveSessions"`
	MonthlyActiveUsers  int64 `json:"monthlyActiveUsers"`
}

type GetAdminStatsQuery struct {
	Result *AdminStats
}

type SystemUserCountStats struct {
	Count int64
}

type GetSystemUserCountStatsQuery struct {
	Result *SystemUserCountStats
}

type UserStats struct {
	Users   int64
	Admins  int64
	Editors int64
	Viewers int64
}
