package cleanup

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/shorturls"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, serverLockService *serverlock.ServerLockService,
	shortURLService shorturls.Service, sqlstore db.DB,
	dashboardVersionService dashver.Service,
	tempUserService tempuser.Service, tracer tracing.Tracer) *CleanUpService {
	s := &CleanUpService{
		Cfg:                     cfg,
		ServerLockService:       serverLockService,
		ShortURLService:         shortURLService,
		store:                   sqlstore,
		log:                     log.New("cleanup"),
		dashboardVersionService: dashboardVersionService,
		tempUserService:         tempUserService,
		tracer:                  tracer,
	}
	return s
}

type CleanUpService struct {
	log                     log.Logger
	tracer                  tracing.Tracer
	store                   db.DB
	Cfg                     *setting.Cfg
	ServerLockService       *serverlock.ServerLockService
	ShortURLService         shorturls.Service
	dashboardVersionService dashver.Service
	tempUserService         tempuser.Service
}

type cleanUpJob struct {
	name string
	fn   func(context.Context)
}

func (j cleanUpJob) String() string {
	return strconv.Quote(j.name)
}

func (srv *CleanUpService) Run(ctx context.Context) error {
	srv.cleanUpTmpFiles(ctx)

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			srv.clean(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *CleanUpService) clean(ctx context.Context) {
	const timeout = 9 * time.Minute
	start := time.Now()
	ctx, span := srv.tracer.Start(ctx, "cleanup background job")
	defer span.End()
	ctx, cancelFn := context.WithTimeout(ctx, timeout)
	defer cancelFn()

	cleanupJobs := []cleanUpJob{
		{"clean up temporary files", srv.cleanUpTmpFiles},
		{"delete expired dashboard versions", srv.deleteExpiredDashboardVersions},
		{"expire old user invites", srv.expireOldUserInvites},
		{"delete stale short URLs", srv.deleteStaleShortURLs},
	}

	logger := srv.log.FromContext(ctx)
	logger.Debug("Starting cleanup jobs", "jobs", fmt.Sprintf("%v", cleanupJobs))

	for _, j := range cleanupJobs {
		if ctx.Err() != nil {
			logger.Error("Cancelled cleanup job", "error", ctx.Err(), "duration", time.Since(start))
			return
		}
		ctx, span := srv.tracer.Start(ctx, j.name)
		j.fn(ctx)
		span.End()
	}

	logger.Info("Completed cleanup jobs", "duration", time.Since(start))
}

func (srv *CleanUpService) cleanUpTmpFiles(ctx context.Context) {
	folders := []string{
		srv.Cfg.ImagesDir,
		srv.Cfg.CSVsDir,
	}

	for _, f := range folders {
		ctx, span := srv.tracer.Start(ctx, "delete stale files in temporary directory")
		span.SetAttributes("directory", f, attribute.Key("directory").String(f))
		srv.cleanUpTmpFolder(ctx, f)
		span.End()
	}
}

func (srv *CleanUpService) cleanUpTmpFolder(ctx context.Context, folder string) {
	logger := srv.log.FromContext(ctx)
	if _, err := os.Stat(folder); os.IsNotExist(err) {
		return
	}

	files, err := os.ReadDir(folder)
	if err != nil {
		logger.Error("Problem reading dir", "folder", folder, "error", err)
		return
	}

	var toDelete []fs.DirEntry
	var now = time.Now()

	for _, file := range files {
		info, err := file.Info()
		if err != nil {
			logger.Error("Problem reading file", "folder", folder, "file", file, "error", err)
			continue
		}

		if srv.shouldCleanupTempFile(info.ModTime(), now) {
			toDelete = append(toDelete, file)
		}
	}

	for _, file := range toDelete {
		fullPath := path.Join(folder, file.Name())
		err := os.Remove(fullPath)
		if err != nil {
			logger.Error("Failed to delete temp file", "file", file.Name(), "error", err)
		}
	}

	logger.Debug("Found old rendered file to delete", "folder", folder, "deleted", len(toDelete), "kept", len(files))
}

func (srv *CleanUpService) shouldCleanupTempFile(filemtime time.Time, now time.Time) bool {
	if srv.Cfg.TempDataLifetime == 0 {
		return false
	}

	return filemtime.Add(srv.Cfg.TempDataLifetime).Before(now)
}

func (srv *CleanUpService) deleteExpiredDashboardVersions(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	cmd := dashver.DeleteExpiredVersionsCommand{}
	if err := srv.dashboardVersionService.DeleteExpired(ctx, &cmd); err != nil {
		logger.Error("Failed to delete expired dashboard versions", "error", err.Error())
	} else {
		logger.Debug("Deleted old/expired dashboard versions", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) expireOldUserInvites(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	maxInviteLifetime := srv.Cfg.UserInviteMaxLifetime

	cmd := models.ExpireTempUsersCommand{
		OlderThan: time.Now().Add(-maxInviteLifetime),
	}

	if err := srv.tempUserService.ExpireOldUserInvites(ctx, &cmd); err != nil {
		logger.Error("Problem expiring user invites", "error", err.Error())
	} else {
		logger.Debug("Expired user invites", "rows affected", cmd.NumExpired)
	}
}

func (srv *CleanUpService) deleteStaleShortURLs(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	cmd := models.DeleteShortUrlCommand{
		OlderThan: time.Now().Add(-time.Hour * 24 * 7),
	}
	if err := srv.ShortURLService.DeleteStaleShortURLs(ctx, &cmd); err != nil {
		logger.Error("Problem deleting stale short urls", "error", err.Error())
	} else {
		logger.Debug("Deleted short urls", "rows affected", cmd.NumDeleted)
	}
}
