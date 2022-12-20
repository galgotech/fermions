package runner

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Runner struct {
	Cfg               *setting.Cfg
	SQLStore          db.DB
	SettingsProvider  setting.Provider
	Features          featuremgmt.FeatureToggles
	EncryptionService encryption.Internal
	UserService       user.Service
}

func New(cfg *setting.Cfg, sqlStore db.DB, settingsProvider setting.Provider,
	encryptionService encryption.Internal, features featuremgmt.FeatureToggles,
	userService user.Service,
) Runner {
	return Runner{
		Cfg:               cfg,
		SQLStore:          sqlStore,
		SettingsProvider:  settingsProvider,
		EncryptionService: encryptionService,
		Features:          features,
		UserService:       userService,
	}
}
