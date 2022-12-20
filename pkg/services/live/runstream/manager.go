package runstream

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.runstream")
)

//go:generate mockgen -destination=mock.go -package=runstream github.com/grafana/grafana/pkg/services/live/runstream ChannelLocalPublisher,NumLocalSubscribersGetter,StreamRunner,PluginContextGetter

type ChannelLocalPublisher interface {
	PublishLocal(channel string, data []byte) error
}

type PluginContextGetter interface {
	GetPluginContext(ctx context.Context, user *user.SignedInUser, pluginID string, skipCache bool) (backend.PluginContext, bool, error)
}

type NumLocalSubscribersGetter interface {
	// GetNumSubscribers returns number of channel subscribers throughout all nodes.
	GetNumLocalSubscribers(channel string) (int, error)
}

type StreamRunner interface {
	RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error
}

type packetSender struct {
	channelLocalPublisher ChannelLocalPublisher
	channel               string
}

func (p *packetSender) Send(packet *backend.StreamPacket) error {
	return p.channelLocalPublisher.PublishLocal(p.channel, packet.Data)
}

// Manager manages streams from Grafana to plugins (i.e. RunStream method).
type Manager struct {
	mu                  sync.RWMutex
	baseCtx             context.Context
	streams             map[string]streamContext
	presenceGetter      NumLocalSubscribersGetter
	pluginContextGetter PluginContextGetter
	channelSender       ChannelLocalPublisher
	registerCh          chan submitRequest
	closedCh            chan struct{}
	checkInterval       time.Duration
	maxChecks           int
}

// ManagerOption modifies Manager behavior (used for tests for example).
type ManagerOption func(*Manager)

// WithCheckConfig allows setting custom check rules.
func WithCheckConfig(interval time.Duration, maxChecks int) ManagerOption {
	return func(sm *Manager) {
		sm.checkInterval = interval
		sm.maxChecks = maxChecks
	}
}

const (
	defaultCheckInterval = 5 * time.Second
	defaultMaxChecks     = 3
)

// NewManager creates new Manager.
func NewManager(channelSender ChannelLocalPublisher, presenceGetter NumLocalSubscribersGetter, pluginContextGetter PluginContextGetter, opts ...ManagerOption) *Manager {
	sm := &Manager{
		streams:             make(map[string]streamContext),
		channelSender:       channelSender,
		presenceGetter:      presenceGetter,
		pluginContextGetter: pluginContextGetter,
		registerCh:          make(chan submitRequest),
		closedCh:            make(chan struct{}),
		checkInterval:       defaultCheckInterval,
		maxChecks:           defaultMaxChecks,
	}
	for _, opt := range opts {
		opt(sm)
	}
	return sm
}

func datasourceKey(orgID int64, dsUID string) string {
	return fmt.Sprintf("%d_%s", orgID, dsUID)
}

func (s *Manager) stopStream(sr streamRequest, cancelFn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	streamCtx, ok := s.streams[sr.Channel]
	if !ok {
		return
	}
	closeCh := streamCtx.CloseCh
	delete(s.streams, sr.Channel)
	cancelFn()
	close(closeCh)
}

func (s *Manager) watchStream(ctx context.Context, cancelFn func(), sr streamRequest) {
	numNoSubscribersChecks := 0
	presenceTicker := time.NewTicker(s.checkInterval)
	defer presenceTicker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-presenceTicker.C:
			numSubscribers, err := s.presenceGetter.GetNumLocalSubscribers(sr.Channel)
			if err != nil {
				logger.Error("Error checking num subscribers", "channel", sr.Channel, "path", sr.Path, "error", err)
				continue
			}
			if numSubscribers > 0 {
				// reset counter since channel has active subscribers.
				numNoSubscribersChecks = 0
				continue
			}
			numNoSubscribersChecks++
			if numNoSubscribersChecks >= s.maxChecks {
				logger.Debug("Stop stream since no active subscribers", "channel", sr.Channel, "path", sr.Path)
				s.stopStream(sr, cancelFn)
				return
			}
		}
	}
}

const streamDurationThreshold = 100 * time.Millisecond
const coolDownDelay = 100 * time.Millisecond
const maxDelay = 5 * time.Second

func getDelay(numErrors int) time.Duration {
	if numErrors == 0 {
		return 0
	}
	delay := coolDownDelay * time.Duration(math.Pow(2, float64(numErrors)))
	if delay > maxDelay {
		return maxDelay
	}
	return delay
}

// run stream until context canceled or stream finished without an error.
func (s *Manager) runStream(ctx context.Context, cancelFn func(), sr streamRequest) {
	defer func() { s.stopStream(sr, cancelFn) }()
	var numFastErrors int
	var delay time.Duration
	var isReconnect bool
	startTime := time.Now()
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pluginCtx := sr.PluginContext

		if isReconnect {
			// Best effort to cool down re-establishment process. We don't have a
			// nice way to understand whether we really need to wait here - so relying
			// on duration time of running a stream.
			if time.Since(startTime) < streamDurationThreshold {
				if delay < maxDelay {
					// Due to not calling getDelay after we have delay larger than maxDelay
					// we avoid possible float overflow errors while calculating delay duration
					// based on numFastErrors.
					delay = getDelay(numFastErrors)
				}
				numFastErrors++
			} else {
				// Assuming that stream successfully started.
				delay = 0
				numFastErrors = 0
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
			}
			startTime = time.Now()

			// Resolve new plugin context as it could be modified since last call.
			// We are using the same user here which initiated stream originally.
			newPluginCtx, ok, err := s.pluginContextGetter.GetPluginContext(ctx, sr.user, pluginCtx.PluginID, false)
			if err != nil {
				logger.Error("Error getting plugin context", "path", sr.Path, "error", err)
				isReconnect = true
				continue
			}
			if !ok {
				logger.Info("No plugin context found, stopping stream", "path", sr.Path)
				return
			}
			pluginCtx = newPluginCtx
		}

		err := sr.StreamRunner.RunStream(
			ctx,
			&backend.RunStreamRequest{
				PluginContext: pluginCtx,
				Path:          sr.Path,
				Data:          sr.Data,
			},
			backend.NewStreamSender(&packetSender{channelLocalPublisher: s.channelSender, channel: sr.Channel}),
		)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				logger.Debug("Stream cleanly finished", "path", sr.Path)
				return
			}
			logger.Error("Error running stream, re-establishing", "path", sr.Path, "error", err, "wait", delay)
			isReconnect = true
			continue
		}
		logger.Debug("Stream finished without error, stopping it", "path", sr.Path)
		return
	}
}

var errClosed = errors.New("stream manager closed")

type streamContext struct {
	CloseCh       chan struct{}
	cancelFn      func()
	streamRequest streamRequest
}

func (s *Manager) registerStream(ctx context.Context, sr submitRequest) {
	s.mu.Lock()
	if streamCtx, ok := s.streams[sr.streamRequest.Channel]; ok {
		s.mu.Unlock()
		sr.responseCh <- submitResponse{Result: submitResult{StreamExists: true, CloseNotify: streamCtx.CloseCh}}
		return
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	closeCh := make(chan struct{})
	s.streams[sr.streamRequest.Channel] = streamContext{
		CloseCh:       closeCh,
		cancelFn:      cancel,
		streamRequest: sr.streamRequest,
	}
	s.mu.Unlock()
	sr.responseCh <- submitResponse{Result: submitResult{StreamExists: false, CloseNotify: closeCh}}
	go s.watchStream(ctx, cancel, sr.streamRequest)
	s.runStream(ctx, cancel, sr.streamRequest)
}

// Run Manager till context canceled.
func (s *Manager) Run(ctx context.Context) error {
	s.baseCtx = ctx
	for {
		select {
		case sr := <-s.registerCh:
			go s.registerStream(ctx, sr)
		case <-ctx.Done():
			close(s.closedCh)
			return ctx.Err()
		}
	}
}

type streamRequest struct {
	Channel       string
	Path          string
	user          *user.SignedInUser
	PluginContext backend.PluginContext
	StreamRunner  StreamRunner
	Data          []byte
}

type submitRequest struct {
	responseCh    chan submitResponse
	streamRequest streamRequest
}

type submitResult struct {
	// StreamExists tells whether stream have been already opened.
	StreamExists bool
	// CloseNotify will be closed as soon as stream cleanly exited.
	CloseNotify chan struct{}
}

type submitResponse struct {
	Error  error
	Result submitResult
}

var errDatasourceNotFound = errors.New("datasource not found")

// SubmitStream submits stream handler in Manager to manage.
// The stream will be opened and kept till channel has active subscribers.
func (s *Manager) SubmitStream(ctx context.Context, user *user.SignedInUser, channel string, path string, data []byte, pCtx backend.PluginContext, streamRunner StreamRunner, isResubmit bool) (*submitResult, error) {
	if isResubmit {
		// Resolve new plugin context as it could be modified since last call.
		newPluginCtx, ok, err := s.pluginContextGetter.GetPluginContext(ctx, user, pCtx.PluginID, false)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, errDatasourceNotFound
		}
		pCtx = newPluginCtx
	}

	req := submitRequest{
		responseCh: make(chan submitResponse, 1),
		streamRequest: streamRequest{
			user:          user,
			Channel:       channel,
			Path:          path,
			PluginContext: pCtx,
			StreamRunner:  streamRunner,
			Data:          data,
		},
	}

	// Send submit request.
	select {
	case s.registerCh <- req:
	case <-s.closedCh:
		close(s.registerCh)
		return nil, errClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Wait for submit response.
	select {
	case resp := <-req.responseCh:
		if resp.Error != nil {
			return nil, resp.Error
		}
		return &resp.Result, nil
	case <-s.closedCh:
		return nil, errClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
