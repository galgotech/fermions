import React from 'react';
import { css } from '@emotion/css'
import classNames from 'classnames';
import SplitPane from 'react-split-pane';
import { Icon } from '@mui/material';

export const Index = () => {
  const flex = css`display: flex;`;
  const flex1 = css`flex: 1 1 0%;`;
  const justifyBetween = css`justify-content: space-between;`;
  const justifyStart = css`justify-content: flex-start`;
  const itemsCenter = css`align-items: center;`;
  
  // const column = css`flex-direction: column;`;
  // const wFull = css`width: 100%`;

  const menuItem = css`
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1 1 0%;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  `

  return (
    <SplitPane primary="first" split="horizontal">
      <header className={classNames(flex, flex1, justifyBetween, css`
        align-items: center;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
        overflow-y: hidden;
        overflow-x: auto;
      `)}>
        <div className={classNames(justifyStart)}>
          <a>
            Fermions
          </a>
        </div>
        <div className={classNames(itemsCenter, css`
          display: inline-flex
        `)}>
          <a className={classNames(css`
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          `)}>teste</a>
          <a className={classNames(css`
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          `)}>teste 2</a>
        </div>
      </header>
      <div>
        <SplitPane primary="first" split="vertical" minSize="150px">
          <aside className={classNames(css`
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
          `)}>
            <nav className={classNames(css`
              display: flex;
              flex-direction: column;
              flex-wrap: nowrap;
            `)}>
              <a className={classNames(menuItem)}>
                <Icon>
                  <svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="-2.78 54.22 365.56 245.56"><path d="M267.246 267.341c26.572.001 55.443-17.497 61.933-43.466 7.451-29.82-10.013-60.551-39.311-69.135a60.34 60.34 0 0 0-17.184-2.167c-8.557.014-17.114.004-25.902.004.598-21.86-7.116-39.902-24.405-53.337a56.8 56.8 0 0 0-37.607-12.127 58.098 58.098 0 0 0-40.487 17.65c-11.133 11.168-16.944 24.83-17.997 40.243l-24.08-8.315c2.145-26.602 23.64-63.346 65.307-72.991 47.529-11.003 91.576 20.022 101.913 63.662 3.951 0 8.061-.389 12.077.062 32.264 3.618 55.147 20.576 67.902 50.386 15.76 36.835 2.371 80.217-30.54 101.795-13.68 8.97-35.278 13.358-51.556 13.395"/><path d="M248.15 292.85s-39.04.289-71.17.065c-33.79-.235-61.053-21.921-69.473-51.402-7.312-25.6-1.444-48.533 16.123-68.474 11.178-12.687 25.044-20.819 41.818-23.711a70.792 70.792 0 0 1 71.982 32.01 73.517 73.517 0 0 1 10.882 51.03c-.165 1.148-.433 1.757-1.794 1.754q-34.228-.057-68.456-.034a11.28 11.28 0 0 1-1.134-.127c-.04-.686-.107-1.325-.108-1.964q-.01-10.548-.002-21.098c.002-2.854.314-3.152 3.222-3.152h41.219c-.363-1.13-.584-2.07-.956-2.944-6.755-15.885-18.64-25.76-35.647-28.59-17.05-2.84-31.94 2.207-43.14 15.521-17.225 20.476-11.832 53.086 10.776 67.821a45.806 45.806 0 0 0 25.617 7.587c31.8-.032 70.178-.007 70.178-.007l.063 25.714"/><path d="M93.066 261.514l15.765 19.942c-21.782 13.708-58.5 14.24-84.102-11.702a71.767 71.767 0 0 1-3.54-96.512c24.25-28.684 62.787-30.793 87.696-15.67l-15.818 19.964c-12.315-5.34-25.212-5.522-37.968.524a44.264 44.264 0 0 0-19.893 18.657 46.213 46.213 0 0 0 5.433 53.303 44.855 44.855 0 0 0 52.427 11.494"/></svg>
                </Icon>
                <span className={classNames(css`margin-top: 0.5rem;`)}>Cloud Events</span>
              </a>
              <a className={classNames(menuItem)}>
                
                  <img width="30" src="data:image/png;base64, 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" />
                
                <span>Workflow</span>
              </a>
              <a className={classNames(menuItem)}>
                <Icon>settings</Icon>
                <span>Settings</span>
              </a>
            </nav>
          </aside>
          <div>
            <main>
              main tete
            </main>
          </div>
          
        </SplitPane>
      </div>
      <div>teste 3</div>
    </SplitPane>
  );
}