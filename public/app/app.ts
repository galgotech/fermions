import 'symbol-observable';
import 'core-js';
import 'regenerator-runtime/runtime';

import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import './polyfills/old-mediaquerylist'; // Safari < 14 does not have mql.addEventListener()
import 'file-saver';
import 'jquery';

import 'app/features/all';

import _ from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';
import ReactDOM from 'react-dom';

import {
  locationUtil,
  monacoLanguageRegistry,
  setLocale,
  setTimeZoneResolver,
  setWeekStart,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import {
  locationService,
  registerEchoBackend,
  setBackendSrv,
  setEchoSrv,
  setLocationSrv,
} from '@grafana/runtime';
import { setPanelRenderer } from '@grafana/runtime/src/components/PanelRenderer';
import { setPluginPage } from '@grafana/runtime/src/components/PluginPage';
import { getScrollbarWidth } from '@grafana/ui';
import config from 'app/core/config';
import { arrayMove } from 'app/core/utils/arrayMove';

import getDefaultMonacoLanguages from '../lib/monaco-languages';

import { AppWrapper } from './AppWrapper';
import { AppChromeService } from './core/components/AppChrome/AppChromeService';
import { getAllOptionEditors, getAllStandardFieldConfigs } from './core/components/OptionsUI/registry';
import { PluginPage } from './core/components/PageNew/PluginPage';
import { GrafanaContextType } from './core/context/GrafanaContext';
import { initializeI18n } from './core/internationalization';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
import { ModalManager } from './core/services/ModalManager';
import { backendSrv } from './core/services/backend_srv';
import { contextSrv } from './core/services/context_srv';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import { ApplicationInsightsBackend } from './core/services/echo/backends/analytics/ApplicationInsightsBackend';
import { GA4EchoBackend } from './core/services/echo/backends/analytics/GA4Backend';
import { GAEchoBackend } from './core/services/echo/backends/analytics/GABackend';
import { RudderstackBackend } from './core/services/echo/backends/analytics/RudderstackBackend';
import { GrafanaJavascriptAgentBackend } from './core/services/echo/backends/grafana-javascript-agent/GrafanaJavascriptAgentBackend';
import { SentryEchoBackend } from './core/services/echo/backends/sentry/SentryBackend';
import { KeybindingSrv } from './core/services/keybindingSrv';
import { initDevFeatures } from './dev';
import { PanelRenderer } from './features/panel/components/PanelRenderer';
import { preloadPlugins } from './features/plugins/pluginPreloader';
import { initWindowRuntime } from './features/runtime/init';
import { configureStore } from './store/configureStore';

// add move to lodash for backward compatabilty with plugins
// @ts-ignore
_.move = arrayMove;

// import symlinked extensions
const extensionsIndex = require.context('.', true, /extensions\/index.ts/);
const extensionsExports = extensionsIndex.keys().map((key) => {
  return extensionsIndex(key);
});

if (process.env.NODE_ENV === 'development') {
  initDevFeatures();
}

export class GrafanaApp {
  context!: GrafanaContextType;

  async init() {
    try {
      // Let iframe container know grafana has started loading
      parent.postMessage('GrafanaAppInit', '*');

      const initI18nPromise = initializeI18n(config.bootData.user.language);

      setBackendSrv(backendSrv);
      initEchoSrv();
      addClassIfNoOverlayScrollbar();
      setLocale(config.bootData.user.locale);
      setWeekStart(config.bootData.user.weekStart);
      setPanelRenderer(PanelRenderer);
      setPluginPage(PluginPage);
      setLocationSrv(locationService);
      setTimeZoneResolver(() => config.bootData.user.timezone);
      // Important that extension reducers are initialized before store
      addExtensionReducers();
      configureStore();
      initExtensions();

      standardEditorsRegistry.setInit(getAllOptionEditors);
      standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);
      monacoLanguageRegistry.setInit(getDefaultMonacoLanguages);

      locationUtil.initialize({
        config,
      });

      // intercept anchor clicks and forward it to custom history instead of relying on browser's history
      document.addEventListener('click', interceptLinkClicks);

      initWindowRuntime();

      // init modal manager
      const modalManager = new ModalManager();
      modalManager.init();

      await Promise.all([
        initI18nPromise,

        // Preload selected app plugins
        await preloadPlugins(config.pluginsToPreload),
      ]);

      // initialize chrome service
      const chromeService = new AppChromeService();
      const keybindingsService = new KeybindingSrv(locationService);

      this.context = {
        backend: backendSrv,
        location: locationService,
        chrome: chromeService,
        keybindings: keybindingsService,
        config,
      };

      ReactDOM.render(
        React.createElement(AppWrapper, {
          app: this,
        }),
        document.getElementById('reactRoot')
      );
    } catch (error) {
      console.error('Failed to start Grafana', error);
      window.__fermions_load_failed();
    }
  }
}

function addExtensionReducers() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].addExtensionReducers();
  }
}

function initExtensions() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].init();
  }
}

function initEchoSrv() {
  setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

  window.addEventListener('load', (e) => {
    const loadMetricName = 'frontend_boot_load_time_seconds';
    // Metrics below are marked in public/views/index-template.html
    const jsLoadMetricName = 'frontend_boot_js_done_time_seconds';
    const cssLoadMetricName = 'frontend_boot_css_time_seconds';

    if (performance) {
      performance.mark(loadMetricName);
      reportMetricPerformanceMark('first-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark('first-contentful-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark(loadMetricName);
      reportMetricPerformanceMark(jsLoadMetricName);
      reportMetricPerformanceMark(cssLoadMetricName);
    }
  });

  if (contextSrv.user.orgRole !== '') {
    registerEchoBackend(new PerformanceBackend({}));
  }

  if (config.sentry.enabled) {
    registerEchoBackend(
      new SentryEchoBackend({
        ...config.sentry,
        user: config.bootData.user,
        buildInfo: config.buildInfo,
      })
    );
  }
  if (config.grafanaJavascriptAgent.enabled) {
    registerEchoBackend(
      new GrafanaJavascriptAgentBackend({
        ...config.grafanaJavascriptAgent,
        app: {
          version: config.buildInfo.version,
          environment: config.buildInfo.env,
        },
        buildInfo: config.buildInfo,
        user: {
          id: String(config.bootData.user?.id),
          email: config.bootData.user?.email,
        },
      })
    );
  }

  if (config.googleAnalyticsId) {
    registerEchoBackend(
      new GAEchoBackend({
        googleAnalyticsId: config.googleAnalyticsId,
      })
    );
  }

  if (config.googleAnalytics4Id) {
    registerEchoBackend(
      new GA4EchoBackend({
        googleAnalyticsId: config.googleAnalytics4Id,
        googleAnalytics4SendManualPageViews: config.googleAnalytics4SendManualPageViews,
      })
    );
  }

  if (config.rudderstackWriteKey && config.rudderstackDataPlaneUrl) {
    registerEchoBackend(
      new RudderstackBackend({
        writeKey: config.rudderstackWriteKey,
        dataPlaneUrl: config.rudderstackDataPlaneUrl,
        user: config.bootData.user,
        sdkUrl: config.rudderstackSdkUrl,
        configUrl: config.rudderstackConfigUrl,
      })
    );
  }

  if (config.applicationInsightsConnectionString) {
    registerEchoBackend(
      new ApplicationInsightsBackend({
        connectionString: config.applicationInsightsConnectionString,
        endpointUrl: config.applicationInsightsEndpointUrl,
      })
    );
  }
}

function addClassIfNoOverlayScrollbar() {
  if (getScrollbarWidth() > 0) {
    document.body.classList.add('no-overlay-scrollbar');
  }
}

/**
 * Report when a metric of a given name was marked during the document lifecycle. Works for markers with no duration,
 * like PerformanceMark or PerformancePaintTiming (e.g. created with performance.mark, or first-contentful-paint)
 */
function reportMetricPerformanceMark(metricName: string, prefix = '', suffix = ''): void {
  const metric = _.first(performance.getEntriesByName(metricName));
  if (metric) {
    const metricName = metric.name.replace(/-/g, '_');
    reportPerformance(`${prefix}${metricName}${suffix}`, Math.round(metric.startTime) / 1000);
  }
}

export default new GrafanaApp();
