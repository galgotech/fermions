// THIS FILE IS GENERATED. EDITING IS FUTILE.
//
// Generated by:
//     public/app/plugins/gen.go
// Using jennies:
//     PluginTreeListJenny
//
// Run 'make gen-cue' from repository root to regenerate.

package corelist

import (
	"fmt"
	"io/fs"

	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

func makeTreeOrPanic(path string, pkgname string, rt *thema.Runtime) *pfs.Tree {
	sub, err := fs.Sub(grafana.CueSchemaFS, path)
	if err != nil {
		panic("could not create fs sub to " + path)
	}
	tree, err := pfs.ParsePluginFS(sub, rt)
	if err != nil {
		panic(fmt.Sprintf("error parsing plugin metadata for %s: %s", pkgname, err))
	}
	return tree
}

func coreTreeList(rt *thema.Runtime) pfs.TreeList {
	return pfs.TreeList{
		makeTreeOrPanic("public/app/plugins/panel/dashlist", "dashlist", rt),
		makeTreeOrPanic("public/app/plugins/panel/gettingstarted", "gettingstarted", rt),
		makeTreeOrPanic("public/app/plugins/panel/live", "live", rt),
		makeTreeOrPanic("public/app/plugins/panel/news", "news", rt),
		makeTreeOrPanic("public/app/plugins/panel/text", "text", rt),
		makeTreeOrPanic("public/app/plugins/panel/welcome", "welcome", rt),
	}
}
