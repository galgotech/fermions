import Mousetrap from 'mousetrap';

import 'mousetrap-global-bind';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import { locationUtil } from '@grafana/data';
import { config, LocationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { DashboardModel } from 'app/features/dashboard/state';

import {
  RemovePanelEvent,
  ShiftTimeEvent,
  ShiftTimeEventDirection,
  ShowModalReactEvent,
  ZoomOutEvent,
  AbsoluteTimeEvent,
} from '../../types/events';
import { HelpModal } from '../components/help/HelpModal';

import { toggleTheme } from './toggleTheme';
import { withFocusedPanel } from './withFocusedPanelId';

export class KeybindingSrv {
  constructor(private locationService: LocationService) {}

  clearAndInitGlobalBindings() {
    Mousetrap.reset();

    if (this.locationService.getLocation().pathname !== '/login') {
      this.bind(['?', 'h'], this.showHelpModal);
      this.bind('g h', this.goToHome);
      this.bind('g p', this.goToProfile);
      this.bind('s o', this.openSearch);
      this.bind('t a', this.makeAbsoluteTime);
      this.bind('f', this.openSearch);
      this.bind('esc', this.exit);
      this.bindGlobalEsc();
    }

    this.bind('c t', () => toggleTheme(false));
    this.bind('c r', () => toggleTheme(true));

    if (process.env.NODE_ENV === 'development') {
      this.bind('t n', () => this.toggleNav());
    }
  }

  bindGlobalEsc() {
    this.bindGlobal('esc', this.globalEsc);
  }

  globalEsc() {
    const anyDoc = document;
    const activeElement = anyDoc.activeElement;

    // typehead needs to handle it
    const typeaheads = document.querySelectorAll('.slate-typeahead--open');
    if (typeaheads.length > 0) {
      return;
    }

    // second check if we are in an input we can blur
    if (activeElement && activeElement instanceof HTMLElement) {
      if (
        activeElement.nodeName === 'INPUT' ||
        activeElement.nodeName === 'TEXTAREA' ||
        activeElement.hasAttribute('data-slate-editor')
      ) {
        activeElement.blur();
        return;
      }
    }

    // ok no focused input or editor that should block this, let exist!
    this.exit();
  }

  toggleNav() {
    window.location.href =
      config.appSubUrl +
      locationUtil.getUrlForPartial(this.locationService.getLocation(), {
        '__feature.topnav': (!config.featureToggles.topnav).toString(),
      });
  }

  private openSearch() {
    this.locationService.partial({ search: 'open' });
  }

  private closeSearch() {
    this.locationService.partial({ search: null });
  }

  private goToHome() {
    this.locationService.push('/');
  }

  private goToProfile() {
    this.locationService.push('/profile');
  }

  private makeAbsoluteTime() {
    appEvents.publish(new AbsoluteTimeEvent());
  }

  private showHelpModal() {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  }

  private exit() {
    const search = this.locationService.getSearchObject();

    if (search.editview) {
      this.locationService.partial({ editview: null, editIndex: null });
      return;
    }

    if (search.inspect) {
      this.locationService.partial({ inspect: null, inspectTab: null });
      return;
    }

    if (search.editPanel) {
      this.locationService.partial({ editPanel: null, tab: null });
      return;
    }

    if (search.viewPanel) {
      this.locationService.partial({ viewPanel: null, tab: null });
      return;
    }

    if (search.search) {
      this.closeSearch();
    }
  }

  private showDashEditView() {
    this.locationService.partial({
      editview: 'settings',
    });
  }

  bind(keyArg: string | string[], fn: () => void) {
    Mousetrap.bind(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  bindGlobal(keyArg: string, fn: () => void) {
    Mousetrap.bindGlobal(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  unbind(keyArg: string, keyType?: string) {
    Mousetrap.unbind(keyArg, keyType);
  }

  bindWithPanelId(keyArg: string, fn: (panelId: number) => void) {
    this.bind(keyArg, withFocusedPanel(fn));
  }

  setupTimeRangeBindings(updateUrl = true) {
    this.bind('t z', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('ctrl+z', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('t left', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left, updateUrl }));
    });

    this.bind('t right', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right, updateUrl }));
    });
  }

  setupDashboardBindings(dashboard: DashboardModel) {
    this.bind('mod+s', () => {
      if (dashboard.meta.canSave) {
        appEvents.publish(
          new ShowModalReactEvent({
            component: SaveDashboardDrawer,
            props: {
              dashboard,
            },
          })
        );
      }
    });

    this.setupTimeRangeBindings();

    // edit panel
    this.bindWithPanelId('e', (panelId) => {
      if (dashboard.canEditPanelById(panelId)) {
        const isEditing = this.locationService.getSearchObject().editPanel !== undefined;
        this.locationService.partial({ editPanel: isEditing ? null : panelId });
      }
    });

    // view panel
    this.bindWithPanelId('v', (panelId) => {
      const isViewing = this.locationService.getSearchObject().viewPanel !== undefined;
      this.locationService.partial({ viewPanel: isViewing ? null : panelId });
    });

    //toggle legend
    this.bindWithPanelId('p l', (panelId) => {
      const panel = dashboard.getPanelById(panelId)!;
      const newOptions = { ...panel.options };

      newOptions.legend.showLegend ? (newOptions.legend.showLegend = false) : (newOptions.legend.showLegend = true);

      panel.updateOptions(newOptions);
    });

    this.bindWithPanelId('i', (panelId) => {
      this.locationService.partial({ inspect: panelId });
    });

    // delete panel
    this.bindWithPanelId('p r', (panelId) => {
      if (dashboard.canEditPanelById(panelId) && !(dashboard.panelInView || dashboard.panelInEdit)) {
        appEvents.publish(new RemovePanelEvent(panelId));
      }
    });

    // duplicate panel
    this.bindWithPanelId('p d', (panelId) => {
      if (dashboard.canEditPanelById(panelId)) {
        const panelIndex = dashboard.getPanelInfoById(panelId)!.index;
        dashboard.duplicatePanel(dashboard.panels[panelIndex]);
      }
    });

    this.bind('d n', () => {
      this.locationService.push('/dashboard/new');
    });

    this.bind('d s', () => {
      this.showDashEditView();
    });

    //Autofit panels
    this.bind('d a', () => {
      // this has to be a full page reload
      const queryParams = this.locationService.getSearchObject();
      const newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
      window.location.href = window.location.href + newUrlParam;
    });
  }
}
