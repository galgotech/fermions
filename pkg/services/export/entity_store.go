package export

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Job = new(entityStoreJob)

type entityStoreJob struct {
	logger log.Logger

	statusMu      sync.Mutex
	status        ExportStatus
	cfg           ExportConfig
	broadcaster   statusBroadcaster
	stopRequested bool
	ctx           context.Context

	sess  *session.SessionDB
	store entity.EntityStoreServer
}

func startEntityStoreJob(ctx context.Context,
	cfg ExportConfig,
	broadcaster statusBroadcaster,
	db db.DB,
	store entity.EntityStoreServer,
) (Job, error) {
	job := &entityStoreJob{
		logger:      log.New("export_to_object_store_job"),
		cfg:         cfg,
		ctx:         ctx,
		broadcaster: broadcaster,
		status: ExportStatus{
			Running: true,
			Target:  "object store export",
			Started: time.Now().UnixMilli(),
			Count:   make(map[string]int, 10),
			Index:   0,
		},
		sess:  db.GetSqlxSession(),
		store: store,
	}

	broadcaster(job.status)
	go job.start(ctx)
	return job, nil
}

func (e *entityStoreJob) requestStop() {
	e.stopRequested = true
}

func (e *entityStoreJob) start(ctx context.Context) {
	defer func() {
		e.logger.Info("Finished dummy export job")

		e.statusMu.Lock()
		defer e.statusMu.Unlock()
		s := e.status
		if err := recover(); err != nil {
			e.logger.Error("export panic", "error", err)
			s.Status = fmt.Sprintf("ERROR: %v", err)
		}
		// Make sure it finishes OK
		if s.Finished < 10 {
			s.Finished = time.Now().UnixMilli()
		}
		s.Running = false
		if s.Status == "" {
			s.Status = "done"
		}
		e.status = s
		e.broadcaster(s)
	}()

	e.logger.Info("Starting dummy export job")
	// Select all dashboards
	rowUser := &user.SignedInUser{
		Login:  "",
		OrgID:  0, // gets filled in from each row
		UserID: 0,
	}
	ctx = store.ContextWithUser(ctx, rowUser)

	what := models.StandardKindDashboard
	e.status.Count[what] = 0

	// TODO paging etc
	// NOTE: doing work inside rows.Next() leads to database locked
	dashInfo, err := e.getDashboards(ctx)
	if err != nil {
		e.status.Status = "error: " + err.Error()
		return
	}
	e.status.Last = fmt.Sprintf("export %d dashboards", len(dashInfo))
	e.broadcaster(e.status)

	for _, dash := range dashInfo {
		rowUser.OrgID = dash.OrgID
		rowUser.UserID = dash.UpdatedBy
		if dash.UpdatedBy < 0 {
			rowUser.UserID = 0 // avoid Uint64Val issue????
		}

		_, err = e.store.AdminWrite(ctx, &entity.AdminWriteEntityRequest{
			GRN: &entity.GRN{
				UID:  dash.UID,
				Kind: models.StandardKindDashboard,
			},
			ClearHistory: true,
			Version:      fmt.Sprintf("%d", dash.Version),
			CreatedAt:    dash.Created.UnixMilli(),
			UpdatedAt:    dash.Updated.UnixMilli(),
			UpdatedBy:    fmt.Sprintf("user:%d", dash.UpdatedBy),
			CreatedBy:    fmt.Sprintf("user:%d", dash.CreatedBy),
			Body:         dash.Data,
			Comment:      "(exported from SQL)",
			Origin: &entity.EntityOriginInfo{
				Source: "export-from-sql",
			},
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("ITEM: %s", dash.UID)
		e.broadcaster(e.status)
	}
}

type dashInfo struct {
	OrgID     int64 `db:"org_id"`
	UID       string
	Version   int64
	Slug      string
	Data      []byte
	Created   time.Time
	Updated   time.Time
	CreatedBy int64 `db:"created_by"`
	UpdatedBy int64 `db:"updated_by"`
}

// TODO, paging etc
func (e *entityStoreJob) getDashboards(ctx context.Context) ([]dashInfo, error) {
	e.status.Last = "find dashbaords...."
	e.broadcaster(e.status)

	dash := make([]dashInfo, 0)
	err := e.sess.Select(ctx, &dash, "SELECT org_id,uid,version,slug,data,created,updated,created_by,updated_by FROM dashboard WHERE is_folder=false")
	return dash, err
}

func (e *entityStoreJob) getStatus() ExportStatus {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.status
}

func (e *entityStoreJob) getConfig() ExportConfig {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.cfg
}
