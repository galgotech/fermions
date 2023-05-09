import React from 'react';
import { createRoot } from 'react-dom/client';
import { css } from '@emotion/css'
import classNames from 'classnames';

import { Index } from 'pages/Index';

// import { Provider } from 'react-redux';

interface Props {
  app: App,
}

interface State { }

class AppWrapper extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const flex = css`display: flex;`;
    const wScreen = css`width: 100vw`;
    const hScreen = css`height: 100vh`;

    return (
      <div className={classNames(flex, wScreen, hScreen)}>
        <Index />
      </div>
    );
  }
}

class App {
  init() {    
    const container = document.getElementById('app');
        const root = createRoot(container!);
        root.render(React.createElement(AppWrapper, { app: this }));  
  }
}

export default new App();
