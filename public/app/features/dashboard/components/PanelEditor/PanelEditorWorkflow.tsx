import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { locationService } from '@grafana/runtime';
import { CodeEditor, Monaco, stylesFactory } from '@grafana/ui';
import config from 'app/core/config';
import { WorkflowOptions } from 'app/types';

import { PanelModel } from '../../state';

interface Props {
  /** Current panel */
  panel: PanelModel;
  /** Added here to make component re-render when workflow change from outside */
  workflow: any
}

interface State {
  scrollElement?: HTMLDivElement;
  json: String;
}

export class PanelEditorWorkflow extends PureComponent<Props, State> {
  state = {
    json: "{}",
  };

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
    setTimeout(() => this.props.panel.render(), 10);

    this.forceUpdate();
  };

  setScrollRef = (scrollElement: HTMLDivElement): void => {
    this.setState({ scrollElement });
  };

  render() {
    const { panel } = this.props;
    const styles = getStyles();

    const onChange = (value: string) => {
      this.onOptionsChange({ workflow: value });
    };

    return (
      <div className={styles.innerWrapper}>
        <CodeEditor
          value={panel.getWorkflowText()}
          language="json"
          width="100%"
          height="50vh"
          containerStyles={styles.codeEditorContainer}
          showMiniMap={true}
          showLineNumbers={true}
          onBlur={onChange}
          onSave={onChange}
          onBeforeEditorMount={(monaco: Monaco) => {
            monaco.languages.json.jsonDefaults.setModeConfiguration({
              colors: true,
              completionItems: true,
              diagnostics: true,
              documentFormattingEdits: true,
              documentRangeFormattingEdits: true,
              documentSymbols: true,
              foldingRanges: true,
              hovers: true,
              selectionRanges: true,
              tokens: true,
            });
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              allowComments: false,
              schemas: [
                {
                  uri:
                    'https://raw.githubusercontent.com/serverlessworkflow/specification/0.8.x/schema/workflow.json',
                  fileMatch: [
                    'https://raw.githubusercontent.com/serverlessworkflow/specification/0.8.x/schema/workflow.json',
                  ],
                },
              ],
              enableSchemaRequest: true,
            });
          }}
          monacoOptions={{
            // model: null,
            readOnly: false,
            autoIndent: 'full',
          }}
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
