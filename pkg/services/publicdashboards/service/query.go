package service

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	dashmodels "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/services/user"
)

// GetMetricRequest returns a metric request for the given panel and query
func (pd *PublicDashboardServiceImpl) GetMetricRequest(ctx context.Context, dashboard *dashmodels.Dashboard, publicDashboard *models.PublicDashboard, panelId int64, queryDto models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	err := validation.ValidateQueryPublicDashboardRequest(queryDto)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	metricReqDTO, err := pd.buildMetricRequest(
		ctx,
		dashboard,
		publicDashboard,
		panelId,
		queryDto,
	)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	return metricReqDTO, nil
}

// GetQueryDataResponse returns a query data response for the given panel and query
func (pd *PublicDashboardServiceImpl) GetQueryDataResponse(ctx context.Context, skipCache bool, queryDto models.PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error) {
	publicDashboard, dashboard, err := pd.FindPublicDashboardAndDashboardByAccessToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}

	metricReq, err := pd.GetMetricRequest(ctx, dashboard, publicDashboard, panelId, queryDto)
	if err != nil {
		return nil, err
	}

	if len(metricReq.Queries) == 0 {
		return nil, models.ErrPanelQueriesNotFound.Errorf("GetQueryDataResponse: failed to extract queries from panel")
	}

	anonymousUser := buildAnonymousUser(ctx, dashboard)
	res, err := pd.QueryDataService.QueryData(ctx, anonymousUser, skipCache, metricReq)

	reqDatasources := metricReq.GetUniqueDatasourceTypes()
	if err != nil {
		LogQueryFailure(reqDatasources, pd.log, err)
		return nil, err
	}
	LogQuerySuccess(reqDatasources, pd.log)

	sanitizeMetadataFromQueryData(res)

	return res, nil
}

// buildMetricRequest merges public dashboard parameters with dashboard and returns a metrics request to be sent to query backend
func (pd *PublicDashboardServiceImpl) buildMetricRequest(ctx context.Context, dashboard *dashmodels.Dashboard, publicDashboard *models.PublicDashboard, panelId int64, reqDTO models.PublicDashboardQueryDTO) (dtos.MetricRequest, error) {
	// group queries by panel
	queriesByPanel := groupQueriesByPanelId(dashboard.Data)
	queries, ok := queriesByPanel[panelId]
	if !ok {
		return dtos.MetricRequest{}, models.ErrPanelNotFound.Errorf("buildMetricRequest: public dashboard panel not found")
	}

	ts := publicDashboard.BuildTimeSettings(dashboard)

	// determine safe resolution to query data at
	safeInterval, safeResolution := pd.getSafeIntervalAndMaxDataPoints(reqDTO, ts)
	for i := range queries {
		queries[i].Set("intervalMs", safeInterval)
		queries[i].Set("maxDataPoints", safeResolution)
	}

	return dtos.MetricRequest{
		From:    ts.From,
		To:      ts.To,
		Queries: queries,
	}, nil
}

// buildAnonymousUser creates a user with permissions to read from all datasources used in the dashboard
func buildAnonymousUser(ctx context.Context, dashboard *dashmodels.Dashboard) *user.SignedInUser {
	datasourceUids := getUniqueDashboardDatasourceUids(dashboard.Data)

	// Create a user with blank permissions
	anonymousUser := &user.SignedInUser{OrgID: dashboard.OrgId, Permissions: make(map[int64]map[string][]string)}

	// Need to access all dashboards since tags annotations span across all dashboards
	dashboardScopes := []string{dashboards.ScopeDashboardsProvider.GetResourceAllScope()}

	// Scopes needed for datasource queries
	queryScopes := make([]string, 0)
	readScopes := make([]string, 0)
	for _, uid := range datasourceUids {
		scope := datasources.ScopeProvider.GetResourceScopeUID(uid)
		queryScopes = append(queryScopes, scope)
		readScopes = append(readScopes, scope)
	}

	// Apply all scopes to the actions we need the user to be able to perform
	permissions := make(map[string][]string)
	permissions[datasources.ActionQuery] = queryScopes
	permissions[datasources.ActionRead] = readScopes
	permissions[dashboards.ActionDashboardsRead] = dashboardScopes

	anonymousUser.Permissions[dashboard.OrgId] = permissions

	return anonymousUser
}

func getUniqueDashboardDatasourceUids(dashboard *simplejson.Json) []string {
	var datasourceUids []string
	exists := map[string]bool{}

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)
		uid := getDataSourceUidFromJson(panel)

		// if uid is for a mixed datasource, get the datasource uids from the targets
		if uid == "-- Mixed --" {
			for _, target := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(target)
				datasourceUid := target.Get("datasource").Get("uid").MustString()
				if _, ok := exists[datasourceUid]; !ok {
					datasourceUids = append(datasourceUids, datasourceUid)
					exists[datasourceUid] = true
				}
			}
		} else {
			if _, ok := exists[uid]; !ok {
				datasourceUids = append(datasourceUids, uid)
				exists[uid] = true
			}
		}
	}

	return datasourceUids
}

func groupQueriesByPanelId(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		var panelQueries []*simplejson.Json

		for _, queryObj := range panel.Get("targets").MustArray() {
			query := simplejson.NewFromAny(queryObj)

			if hideAttr, exists := query.CheckGet("hide"); !exists || !hideAttr.MustBool() {
				// We dont support exemplars for public dashboards currently
				query.Del("exemplar")

				// if query target has no datasource, set it to have the datasource on the panel
				if _, ok := query.CheckGet("datasource"); !ok {
					uid := getDataSourceUidFromJson(panel)
					datasource := map[string]interface{}{"type": "public-ds", "uid": uid}
					query.Set("datasource", datasource)
				}

				panelQueries = append(panelQueries, query)
			}
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}

	return result
}

func getDataSourceUidFromJson(query *simplejson.Json) string {
	uid := query.Get("datasource").Get("uid").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	return uid
}

func sanitizeMetadataFromQueryData(res *backend.QueryDataResponse) {
	for k := range res.Responses {
		frames := res.Responses[k].Frames
		for i := range frames {
			if frames[i].Meta != nil {
				frames[i].Meta.ExecutedQueryString = ""
				frames[i].Meta.Custom = nil
			}
		}
	}
}
