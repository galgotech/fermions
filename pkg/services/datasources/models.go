package datasources

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DataSource struct {
	Id    int64 `json:"id,omitempty"`
	OrgId int64 `json:"orgId,omitempty"`

	Name           string            `json:"name"`
	JsonData       *simplejson.Json  `json:"jsonData"`
	SecureJsonData map[string][]byte `json:"secureJsonData"`

	Updated time.Time `json:"updated,omitempty"`
}

// AllowedCookies parses the jsondata.keepCookies and returns a list of
// allowed cookies, otherwise an empty list.
func (ds DataSource) AllowedCookies() []string {
	if ds.JsonData != nil {
		if keepCookies := ds.JsonData.Get("keepCookies"); keepCookies != nil {
			return keepCookies.MustStringArray()
		}
	}

	return []string{}
}

// Specific error type for grpc secrets management so that we can show more detailed plugin errors to users
type ErrDatasourceSecretsPluginUserFriendly struct {
	Err string
}

func (e ErrDatasourceSecretsPluginUserFriendly) Error() string {
	return e.Err
}
