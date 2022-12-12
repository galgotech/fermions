import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { DataQuery } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CodeEditor, stylesFactory } from '@grafana/ui';
import config from 'app/core/config';
import { defaultCodeOptions } from 'app/plugins/panel/text/models.gen';
import { WorkflowOptions } from 'app/types';

import { PanelModel } from '../../state';

interface Props {
  /** Current panel */
  panel: PanelModel;
  /** Added here to make component re-render when queries change from outside */
  queries: DataQuery[];
}

interface State {
  scrollElement?: HTMLDivElement;
}

export class PanelEditorCode extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
  }

  onRunQueries = () => {
    this.props.panel.render();
  };

  onOpenQueryInspector = () => {
    locationService.partial({
      inspect: this.props.panel.id,
      inspectTab: 'query',
    });
  };

  onOptionsChange = (options: WorkflowOptions) => {
    const { panel } = this.props;

    panel.updateQueries(options);

    if (false) { // options.dataSource.uid !== panel.datasource?.uid
      // trigger queries when changing data source
      setTimeout(this.onRunQueries, 10);
    }

    this.forceUpdate();
  };

  setScrollRef = (scrollElement: HTMLDivElement): void => {
    this.setState({ scrollElement });
  };

  render() {
    // const { panel } = this.props;
    const styles = getStyles();
    const code = defaultCodeOptions;

    return (
      <div className={styles.innerWrapper}>
        <CodeEditor
          key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
          value={""}
          language={code.language!}
          width="100%"
          height="50vh"
          containerStyles={styles.codeEditorContainer}
          showMiniMap={code.showMiniMap}
          showLineNumbers={code.showLineNumbers}
          readOnly={true} // future
        />
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    innerWrapper: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.md};
    `,
    codeEditorContainer: css`
      .monaco-editor .margin,
      .monaco-editor-background {
        background-color: ${theme.colors.bg1};
      }
    `,
  }
});
