package plugins

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

var ErrFileNotExist = fmt.Errorf("file does not exist")

type Plugin struct {
	JSONData

	PluginDir string
	Class     Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      SignatureStatus
	SignatureType  SignatureType
	SignatureOrg   string
	Parent         *Plugin
	Children       []*Plugin
	SignatureError *SignatureError

	// SystemJS fields
	Module  string
	BaseURL string

	log log.Logger
}

type PluginDTO struct {
	JSONData

	logger    log.Logger
	pluginDir string

	Class Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      SignatureStatus
	SignatureType  SignatureType
	SignatureOrg   string
	SignatureError *SignatureError

	// SystemJS fields
	Module  string
	BaseURL string

	// temporary
	backend.StreamHandler
}

func (p PluginDTO) SupportsStreaming() bool {
	return p.StreamHandler != nil
}

func (p PluginDTO) IsApp() bool {
	return p.Type == App
}

func (p PluginDTO) IsCorePlugin() bool {
	return p.Class == Core
}

func (p PluginDTO) IsExternalPlugin() bool {
	return p.Class == External
}

func (p PluginDTO) IsSecretsManager() bool {
	return p.JSONData.Type == SecretsManager
}

func (p PluginDTO) File(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if err != nil {
		// CleanRelativePath should clean and make the path relative so this is not expected to fail
		return nil, err
	}

	absPluginDir, err := filepath.Abs(p.pluginDir)
	if err != nil {
		return nil, err
	}

	absFilePath := filepath.Join(absPluginDir, cleanPath)
	// Wrapping in filepath.Clean to properly handle
	// gosec G304 Potential file inclusion via variable rule.
	f, err := os.Open(filepath.Clean(absFilePath))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotExist
		}
		return nil, err
	}
	return f, nil
}

// JSONData represents the plugin's plugin.json
type JSONData struct {
	// Common settings
	ID           string       `json:"id"`
	Type         Type         `json:"type"`
	Name         string       `json:"name"`
	Info         Info         `json:"info"`
	Dependencies Dependencies `json:"dependencies"`
	Includes     []*Includes  `json:"includes"`
	State        ReleaseState `json:"state,omitempty"`
	Category     string       `json:"category"`
	HideFromList bool         `json:"hideFromList,omitempty"`
	Preload      bool         `json:"preload"`
	Routes       []*Route     `json:"routes"`

	// AccessControl settings
	Roles []RoleRegistration `json:"roles,omitempty"`

	// Panel settings
	SkipDataQuery bool `json:"skipDataQuery"`

	// App settings
	AutoEnabled bool `json:"autoEnabled"`

	// Datasource settings
	Metrics      bool            `json:"metrics"`
	Explore      bool            `json:"explore"`
	Table        bool            `json:"tables"`
	Logs         bool            `json:"logs"`
	Tracing      bool            `json:"tracing"`
	QueryOptions map[string]bool `json:"queryOptions,omitempty"`
	BuiltIn      bool            `json:"builtIn,omitempty"`
	Mixed        bool            `json:"mixed,omitempty"`
	Streaming    bool            `json:"streaming"`
	SDK          bool            `json:"sdk,omitempty"`

	// Backend (SecretsManager)
	Executable string `json:"executable,omitempty"`
}

func (d JSONData) DashboardIncludes() []*Includes {
	result := []*Includes{}
	for _, include := range d.Includes {
		if include.Type == TypeDashboard {
			result = append(result, include)
		}
	}

	return result
}

// Route describes a plugin route that is defined in
// the plugin.json file for a plugin.
type Route struct {
	Path         string          `json:"path"`
	Method       string          `json:"method"`
	ReqRole      org.RoleType    `json:"reqRole"`
	URL          string          `json:"url"`
	URLParams    []URLParam      `json:"urlParams"`
	Headers      []Header        `json:"headers"`
	AuthType     string          `json:"authType"`
	TokenAuth    *JWTTokenAuth   `json:"tokenAuth"`
	JwtTokenAuth *JWTTokenAuth   `json:"jwtTokenAuth"`
	Body         json.RawMessage `json:"body"`
}

// Header describes an HTTP header that is forwarded with
// the proxied request for a plugin route
type Header struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// URLParam describes query string parameters for
// a url in a plugin route
type URLParam struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// JWTTokenAuth struct is both for normal Token Auth and JWT Token Auth with
// an uploaded JWT file.
type JWTTokenAuth struct {
	Url    string            `json:"url"`
	Scopes []string          `json:"scopes"`
	Params map[string]string `json:"params"`
}

func (p *Plugin) PluginID() string {
	return p.ID
}

func (p *Plugin) Logger() log.Logger {
	return p.log
}

func (p *Plugin) SetLogger(l log.Logger) {
	p.log = l
}

func (p *Plugin) ExecutablePath() string {
	os := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	extension := ""

	if os == "windows" {
		extension = ".exe"
	}

	if p.IsSecretsManager() {
		return filepath.Join(p.PluginDir, fmt.Sprintf("%s_%s_%s%s", "secrets_plugin_start", os, strings.ToLower(arch), extension))
	}

	return filepath.Join(p.PluginDir, fmt.Sprintf("%s_%s_%s%s", p.Executable, os, strings.ToLower(arch), extension))
}

type PluginClient interface {
	backend.QueryDataHandler
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

func (p *Plugin) ToDTO() PluginDTO {

	return PluginDTO{
		logger:          p.Logger(),
		pluginDir:       p.PluginDir,
		JSONData:        p.JSONData,
		Class:           p.Class,
		IncludedInAppID: p.IncludedInAppID,
		DefaultNavURL:   p.DefaultNavURL,
		Pinned:          p.Pinned,
		Signature:       p.Signature,
		SignatureType:   p.SignatureType,
		SignatureOrg:    p.SignatureOrg,
		SignatureError:  p.SignatureError,
		Module:          p.Module,
		BaseURL:         p.BaseURL,
	}
}

func (p *Plugin) StaticRoute() *StaticRoute {
	if p.IsCorePlugin() {
		return nil
	}

	return &StaticRoute{Directory: p.PluginDir, PluginID: p.ID}
}

func (p *Plugin) IsSecretsManager() bool {
	return p.Type == "secretsmanager"
}

func (p *Plugin) IsPanel() bool {
	return p.Type == "panel"
}

func (p *Plugin) IsApp() bool {
	return p.Type == "app"
}

func (p *Plugin) IsCorePlugin() bool {
	return p.Class == Core
}

func (p *Plugin) IsBundledPlugin() bool {
	return p.Class == Bundled
}

func (p *Plugin) IsExternalPlugin() bool {
	return p.Class == External
}

func (p *Plugin) Manifest() []byte {
	d, err := os.ReadFile(filepath.Join(p.PluginDir, "MANIFEST.txt"))
	if err != nil {
		return []byte{}
	}

	return d
}

type Class string

const (
	Core     Class = "core"
	Bundled  Class = "bundled"
	External Class = "external"
)

var PluginTypes = []Type{
	DataSource,
	Panel,
	App,
	SecretsManager,
}

type Type string

const (
	DataSource     Type = "datasource"
	Panel          Type = "panel"
	App            Type = "app"
	SecretsManager Type = "secretsmanager"
)

func (pt Type) IsValid() bool {
	switch pt {
	case DataSource, Panel, App, SecretsManager:
		return true
	}
	return false
}
