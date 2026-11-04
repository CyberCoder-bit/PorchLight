// Indiana-wide pieces: the "Get help in Indiana" page and
// anything else that depends on the community profile (src/community.js).
// Register routes here; never edit src/app.js. See the ctx contract in app.js.

import { COMMUNITY, localHelpFor } from '../community.js';
import { helpPage } from './help-page.js';

export function registerIndiana(router, ctx) {
  // "Get help in Indiana": the community's Area Agency on Aging, Indiana 211,
  // the statewide agency list, and the 911 safety line. Fixed, cited data only.
  router.get('/help', (req, res) => {
    ctx.render(req, res, {
      title: 'Get help in Indiana',
      active: 'help',
      body: helpPage({ community: COMMUNITY, resources: localHelpFor(COMMUNITY) }),
    });
  });
}
