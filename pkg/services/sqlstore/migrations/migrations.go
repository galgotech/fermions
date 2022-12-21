package migrations

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// --- Migration Guide line ---
// 1. Never change a migration that is committed and pushed to main
// 2. Always add new migrations (to change or undo previous migrations)
// 3. Some migrations are not yet written (rename column, table, drop table, index etc)
// 4. Putting migrations behind feature flags is no longer recommended as broken
//    migrations may not be caught by integration tests unless feature flags are
//    specifically added

type OSSMigrations struct {
}

func ProvideOSSMigrations() *OSSMigrations {
	return &OSSMigrations{}
}

func (*OSSMigrations) AddMigration(mg *Migrator) {
	addMigrationLogMigrations(mg)
	addUserMigrations(mg)
	addTempUserMigrations(mg)
	addStarMigrations(mg)
	addOrgMigrations(mg)
	addDashboardMigration(mg) // Do NOT add more migrations to this function.
	addApiKeyMigrations(mg)
	addQuotaMigration(mg)
	addAppSettingsMigration(mg)
	addSessionMigration(mg)
	addPreferencesMigrations(mg)
	addTestDataMigrations(mg)
	addDashboardVersionMigration(mg)
	addTeamMigrations(mg)
	addDashboardACLMigrations(mg) // Do NOT add more migrations to this function.
	addTagMigration(mg)
	addLoginAttemptMigrations(mg)
	addUserAuthMigrations(mg)
	addServerlockMigrations(mg)
	addUserAuthTokenMigrations(mg)
	addCacheMigration(mg)
	addLibraryElementsMigrations(mg)
	if mg.Cfg != nil && mg.Cfg.IsFeatureToggleEnabled != nil {
		if mg.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagLiveConfig) {
			addLiveChannelMigrations(mg)
		}
	}

	addSecretsMigration(mg)
	addKVStoreMigrations(mg)
	accesscontrol.AddMigration(mg)
	addQueryHistoryMigrations(mg)

	accesscontrol.AddTeamMembershipMigrations(mg)
	accesscontrol.AddDashboardPermissionsMigrator(mg)

	addQueryHistoryStarMigrations(mg)

	if mg.Cfg != nil && mg.Cfg.IsFeatureToggleEnabled != nil {
		if mg.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagDashboardComments) || mg.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagAnnotationComments) {
			addCommentGroupMigrations(mg)
			addCommentMigrations(mg)
		}
	}

	addEntityEventsTableMigration(mg)

	addDbFileStorageMigration(mg)

	accesscontrol.AddManagedPermissionsMigration(mg, accesscontrol.ManagedPermissionsMigrationID)
	accesscontrol.AddActionNameMigrator(mg)

	accesscontrol.AddAdminOnlyMigration(mg)
	accesscontrol.AddSeedAssignmentMigrations(mg)

	// TODO: This migration will be enabled later in the nested folder feature
	// implementation process. It is on hold so we can continue working on the
	// store implementation without impacting any grafana instances built off
	// main.
	//
	// addFolderMigrations(mg)
}

func addMigrationLogMigrations(mg *Migrator) {
	migrationLogV1 := Table{
		Name: "migration_log",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "migration_id", Type: DB_NVarchar, Length: 255},
			{Name: "sql", Type: DB_Text},
			{Name: "success", Type: DB_Bool},
			{Name: "error", Type: DB_Text},
			{Name: "timestamp", Type: DB_DateTime},
		},
	}

	mg.AddMigration("create migration_log table", NewAddTableMigration(migrationLogV1))
}

func addStarMigrations(mg *Migrator) {
	starV1 := Table{
		Name: "star",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id", "dashboard_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create star table", NewAddTableMigration(starV1))
	mg.AddMigration("add unique index star.user_id_dashboard_id", NewAddIndexMigration(starV1, starV1.Indices[0]))
}
