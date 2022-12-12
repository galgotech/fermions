import * as dashListPanel from 'app/plugins/panel/dashlist/module';
import * as gettingStartedPanel from 'app/plugins/panel/gettingstarted/module';
import * as livePanel from 'app/plugins/panel/live/module';
import * as newsPanel from 'app/plugins/panel/news/module';
import * as textPanel from 'app/plugins/panel/text/module';
import * as welcomeBanner from 'app/plugins/panel/welcome/module';

// Async loaded panels

const builtInPlugins: any = {

  'app/plugins/panel/text/module': textPanel,
  'app/plugins/panel/dashlist/module': dashListPanel,
  'app/plugins/panel/news/module': newsPanel,
  'app/plugins/panel/live/module': livePanel,
  'app/plugins/panel/gettingstarted/module': gettingStartedPanel,
  'app/plugins/panel/welcome/module': welcomeBanner,
};

export default builtInPlugins;
