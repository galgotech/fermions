package setting

type OrgQuota struct {
	User      int64 `target:"org_user"`
	Dashboard int64 `target:"dashboard"`
	ApiKey    int64 `target:"api_key"`
	AlertRule int64 `target:"alert_rule"`
}

type UserQuota struct {
	Org int64 `target:"org_user"`
}

type GlobalQuota struct {
	Org       int64 `target:"org"`
	User      int64 `target:"user"`
	Dashboard int64 `target:"dashboard"`
	ApiKey    int64 `target:"api_key"`
	Session   int64 `target:"-"`
	File      int64 `target:"file"`
}

type QuotaSettings struct {
	Enabled bool
	Org     OrgQuota
	User    UserQuota
	Global  GlobalQuota
}

func (cfg *Cfg) readQuotaSettings() {
	// set global defaults.
	quota := cfg.Raw.Section("quota")
	cfg.Quota.Enabled = quota.Key("enabled").MustBool(false)

	// per ORG Limits
	cfg.Quota.Org = OrgQuota{
		User:      quota.Key("org_user").MustInt64(10),
		Dashboard: quota.Key("org_dashboard").MustInt64(10),
		ApiKey:    quota.Key("org_api_key").MustInt64(10),
	}

	// per User limits
	cfg.Quota.User = UserQuota{
		Org: quota.Key("user_org").MustInt64(10),
	}

	// Global Limits
	cfg.Quota.Global = GlobalQuota{
		User:      quota.Key("global_user").MustInt64(-1),
		Org:       quota.Key("global_org").MustInt64(-1),
		Dashboard: quota.Key("global_dashboard").MustInt64(-1),
		ApiKey:    quota.Key("global_api_key").MustInt64(-1),
		Session:   quota.Key("global_session").MustInt64(-1),
		File:      quota.Key("global_file").MustInt64(-1),
	}
}
