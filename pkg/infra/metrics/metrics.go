package metrics

import (
	"runtime"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// ExporterName is used as namespace for exposing prometheus metrics
const ExporterName = "grafana"

var (
	// MInstanceStart is a metric counter for started instances
	MInstanceStart prometheus.Counter

	// MPageStatus is a metric page http response status
	MPageStatus *prometheus.CounterVec

	// MApiStatus is a metric api http response status
	MApiStatus *prometheus.CounterVec

	// MProxyStatus is a metric proxy http response status
	MProxyStatus *prometheus.CounterVec

	// MApiUserSignUpStarted is a metric amount of users who started the signup flow
	MApiUserSignUpStarted prometheus.Counter

	// MApiUserSignUpCompleted is a metric amount of users who completed the signup flow
	MApiUserSignUpCompleted prometheus.Counter

	// MApiUserSignUpInvite is a metric amount of users who have been invited
	MApiUserSignUpInvite prometheus.Counter

	// MApiDashboardSave is a metric summary for dashboard save duration
	MApiDashboardSave prometheus.Summary

	// MApiDashboardGet is a metric summary for dashboard get duration
	MApiDashboardGet prometheus.Summary

	// MApiDashboardSearch is a metric summary for dashboard search duration
	MApiDashboardSearch prometheus.Summary

	// MApiAdminUserCreate is a metric api admin user created counter
	MApiAdminUserCreate prometheus.Counter

	// MApiLoginPost is a metric api login post counter
	MApiLoginPost prometheus.Counter

	// MApiLoginOAuth is a metric api login oauth counter
	MApiLoginOAuth prometheus.Counter

	// MApiLoginSAML is a metric api login SAML counter
	MApiLoginSAML prometheus.Counter

	// MApiOrgCreate is a metric api org created counter
	MApiOrgCreate prometheus.Counter

	// MApiDashboardInsert is a metric dashboards inserted
	MApiDashboardInsert prometheus.Counter

	// MDBDataSourceQueryByID is a metric counter for getting datasource by id
	MDBDataSourceQueryByID prometheus.Counter

	// LDAPUsersSyncExecutionTime is a metric summary for LDAP users sync execution duration
	LDAPUsersSyncExecutionTime prometheus.Summary

	// MAccessEvaluationCount is a metric gauge for total number of evaluation requests
	MAccessEvaluationCount prometheus.Counter
)

// Timers
var (
	// MAlertingExecutionTime is a metric summary of alert execution duration
	MAlertingExecutionTime prometheus.Summary

	// MAccessPermissionsSummary is a metric summary for loading permissions request duration when evaluating access
	MAccessPermissionsSummary prometheus.Histogram

	// MAccessEvaluationsSummary is a metric summary for loading permissions request duration when evaluating access
	MAccessEvaluationsSummary prometheus.Histogram
)

// StatTotals
var (
	// MAlertingActiveAlerts is a metric amount of active alerts
	MAlertingActiveAlerts prometheus.Gauge

	// MStatTotalDashboards is a metric total amount of dashboards
	MStatTotalDashboards prometheus.Gauge

	// MStatTotalDashboards is a metric total amount of dashboards
	MStatTotalFolders prometheus.Gauge

	// MStatTotalUsers is a metric total amount of users
	MStatTotalUsers prometheus.Gauge

	// MStatActiveUsers is a metric number of active users
	MStatActiveUsers prometheus.Gauge

	// MStatTotalOrgs is a metric total amount of orgs
	MStatTotalOrgs prometheus.Gauge

	// StatsTotalViewers is a metric total amount of viewers
	StatsTotalViewers prometheus.Gauge

	// StatsTotalEditors is a metric total amount of editors
	StatsTotalEditors prometheus.Gauge

	// StatsTotalAdmins is a metric total amount of admins
	StatsTotalAdmins prometheus.Gauge

	// StatsTotalActiveViewers is a metric total amount of viewers
	StatsTotalActiveViewers prometheus.Gauge

	// StatsTotalActiveEditors is a metric total amount of active editors
	StatsTotalActiveEditors prometheus.Gauge

	// StatsTotalActiveAdmins is a metric total amount of active admins
	StatsTotalActiveAdmins prometheus.Gauge

	// StatsTotalDashboardVersions is a metric of total number of dashboard versions stored in Grafana.
	StatsTotalDashboardVersions prometheus.Gauge

	grafanaPluginBuildInfoDesc *prometheus.GaugeVec

	// StatsTotalLibraryPanels is a metric of total number of library panels stored in Grafana.
	StatsTotalLibraryPanels prometheus.Gauge

	// StatsTotalLibraryVariables is a metric of total number of library variables stored in Grafana.
	StatsTotalLibraryVariables prometheus.Gauge

	// StatsTotalDataKeys is a metric of total number of data keys stored in Grafana.
	StatsTotalDataKeys *prometheus.GaugeVec
)

func init() {
	httpStatusCodes := []string{"200", "404", "500", "unknown"}
	objectiveMap := map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001}

	MInstanceStart = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "instance_start_total",
		Help:      "counter for started instances",
		Namespace: ExporterName,
	})

	MPageStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "page_response_status_total",
			Help:      "page http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MApiStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "api_response_status_total",
			Help:      "api http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MProxyStatus = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Name:      "proxy_response_status_total",
			Help:      "proxy http response status",
			Namespace: ExporterName,
		}, []string{"code"}, map[string][]string{"code": httpStatusCodes})

	MApiUserSignUpStarted = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_started_total",
		Help:      "amount of users who started the signup flow",
		Namespace: ExporterName,
	})

	MApiUserSignUpCompleted = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_completed_total",
		Help:      "amount of users who completed the signup flow",
		Namespace: ExporterName,
	})

	MApiUserSignUpInvite = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_user_signup_invite_total",
		Help:      "amount of users who have been invited",
		Namespace: ExporterName,
	})

	MApiDashboardSave = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_save_milliseconds",
		Help:       "summary for dashboard save duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiDashboardGet = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_get_milliseconds",
		Help:       "summary for dashboard get duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiDashboardSearch = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "api_dashboard_search_milliseconds",
		Help:       "summary for dashboard search duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MApiAdminUserCreate = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_admin_user_created_total",
		Help:      "api admin user created counter",
		Namespace: ExporterName,
	})

	MApiLoginPost = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_post_total",
		Help:      "api login post counter",
		Namespace: ExporterName,
	})

	MApiLoginOAuth = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_oauth_total",
		Help:      "api login oauth counter",
		Namespace: ExporterName,
	})

	MApiLoginSAML = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_login_saml_total",
		Help:      "api login saml counter",
		Namespace: ExporterName,
	})

	MApiOrgCreate = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_org_create_total",
		Help:      "api org created counter",
		Namespace: ExporterName,
	})

	MApiDashboardInsert = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "api_models_dashboard_insert_total",
		Help:      "dashboards inserted ",
		Namespace: ExporterName,
	})

	MDBDataSourceQueryByID = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name:      "db_datasource_query_by_id_total",
		Help:      "counter for getting datasource by id",
		Namespace: ExporterName,
	})

	LDAPUsersSyncExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "ldap_users_sync_execution_time",
		Help:       "summary for LDAP users sync execution duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MAlertingExecutionTime = prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       "alerting_execution_time_milliseconds",
		Help:       "summary of alert execution duration",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	MAlertingActiveAlerts = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "alerting_active_alerts",
		Help:      "amount of active alerts",
		Namespace: ExporterName,
	})

	MStatTotalDashboards = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_dashboard",
		Help:      "total amount of dashboards",
		Namespace: ExporterName,
	})

	MStatTotalFolders = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_folder",
		Help:      "total amount of folders",
		Namespace: ExporterName,
	})

	MStatTotalUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_users",
		Help:      "total amount of users",
		Namespace: ExporterName,
	})

	MStatActiveUsers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_active_users",
		Help:      "number of active users",
		Namespace: ExporterName,
	})

	MStatTotalOrgs = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_orgs",
		Help:      "total amount of orgs",
		Namespace: ExporterName,
	})

	StatsTotalViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_viewers",
		Help:      "total amount of viewers",
		Namespace: ExporterName,
	})

	StatsTotalEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_editors",
		Help:      "total amount of editors",
		Namespace: ExporterName,
	})

	StatsTotalAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_admins",
		Help:      "total amount of admins",
		Namespace: ExporterName,
	})

	StatsTotalActiveViewers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_viewers",
		Help:      "total amount of viewers",
		Namespace: ExporterName,
	})

	StatsTotalActiveEditors = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_editors",
		Help:      "total amount of active editors",
		Namespace: ExporterName,
	})

	StatsTotalActiveAdmins = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_active_admins",
		Help:      "total amount of active admins",
		Namespace: ExporterName,
	})

	grafanaPluginBuildInfoDesc = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "plugin_build_info",
		Help:      "A metric with a constant '1' value labeled by pluginId, pluginType and version from which Grafana plugin was built",
		Namespace: ExporterName,
	}, []string{"plugin_id", "plugin_type", "version", "signature_status"})

	StatsTotalDashboardVersions = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_dashboard_versions",
		Help:      "total amount of dashboard versions in the database",
		Namespace: ExporterName,
	})

	MAccessPermissionsSummary = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "access_permissions_duration",
		Help:    "Histogram for the runtime of permissions check function.",
		Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
	})

	MAccessEvaluationsSummary = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "access_evaluation_duration",
		Help:    "Histogram for the runtime of evaluation function.",
		Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
	})

	MAccessEvaluationCount = prometheus.NewCounter(prometheus.CounterOpts{
		Name:      "access_evaluation_count",
		Help:      "number of evaluation calls",
		Namespace: ExporterName,
	})

	StatsTotalLibraryPanels = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_library_panels",
		Help:      "total amount of library panels in the database",
		Namespace: ExporterName,
	})

	StatsTotalLibraryVariables = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_totals_library_variables",
		Help:      "total amount of library variables in the database",
		Namespace: ExporterName,
	})

	StatsTotalDataKeys = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "stat_totals_data_keys",
		Help:      "total amount of data keys in the database",
		Namespace: ExporterName,
	}, []string{"active"})

}

// SetBuildInformation sets the build information for this binary
func SetBuildInformation(version, revision, branch string, buildTimestamp int64) {
	edition := "oss"
	if setting.IsEnterprise {
		edition = "enterprise"
	}

	grafanaBuildVersion := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "build_info",
		Help:      "A metric with a constant '1' value labeled by version, revision, branch, and goversion from which Grafana was built",
		Namespace: ExporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})

	grafanaBuildTimestamp := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "build_timestamp",
		Help:      "A metric exposing when the binary was built in epoch",
		Namespace: ExporterName,
	}, []string{"version", "revision", "branch", "goversion", "edition"})

	prometheus.MustRegister(grafanaBuildVersion, grafanaBuildTimestamp)

	grafanaBuildVersion.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(1)
	grafanaBuildTimestamp.WithLabelValues(version, revision, branch, runtime.Version(), edition).Set(float64(buildTimestamp))
}

// SetEnvironmentInformation exposes environment values provided by the operators as an `_info` metric.
// If there are no environment metrics labels configured, this metric will not be exposed.
func SetEnvironmentInformation(labels map[string]string) error {
	if len(labels) == 0 {
		return nil
	}

	grafanaEnvironmentInfo := prometheus.NewGauge(prometheus.GaugeOpts{
		Name:        "environment_info",
		Help:        "A metric with a constant '1' value labeled by environment information about the running instance.",
		Namespace:   ExporterName,
		ConstLabels: labels,
	})

	prometheus.MustRegister(grafanaEnvironmentInfo)

	grafanaEnvironmentInfo.Set(1)
	return nil
}

func SetPluginBuildInformation(pluginID, pluginType, version, signatureStatus string) {
	grafanaPluginBuildInfoDesc.WithLabelValues(pluginID, pluginType, version, signatureStatus).Set(1)
}

func initMetricVars() {
	prometheus.MustRegister(
		MInstanceStart,
		MPageStatus,
		MApiStatus,
		MProxyStatus,
		MApiUserSignUpStarted,
		MApiUserSignUpCompleted,
		MApiUserSignUpInvite,
		MApiDashboardSave,
		MApiDashboardGet,
		MApiDashboardSearch,
		MApiAdminUserCreate,
		MApiLoginPost,
		MApiLoginOAuth,
		MApiLoginSAML,
		MApiOrgCreate,
		MApiDashboardInsert,
		MDBDataSourceQueryByID,
		LDAPUsersSyncExecutionTime,
		MAccessPermissionsSummary,
		MAccessEvaluationsSummary,
		MStatTotalDashboards,
		MStatTotalFolders,
		MStatTotalUsers,
		MStatActiveUsers,
		MStatTotalOrgs,
		StatsTotalViewers,
		StatsTotalEditors,
		StatsTotalAdmins,
		StatsTotalActiveViewers,
		StatsTotalActiveEditors,
		StatsTotalActiveAdmins,
		grafanaPluginBuildInfoDesc,
		StatsTotalDashboardVersions,
		MAccessEvaluationCount,
		StatsTotalLibraryPanels,
		StatsTotalLibraryVariables,
		StatsTotalDataKeys,
	)
}
