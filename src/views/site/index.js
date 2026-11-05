// The public website (v2): what a signed-out visitor sees.
// Routes: /, /how-it-works, /for-seniors, /for-volunteers,
// /for-families, /languages, /safety, /about. Who may open them is in
// ./access.js (everyone, signed in or not). The coordinator home is /admin.
//
// registerSite() is called in createApp() after the app's own routes and
// before registerRoles() (which must stay last).

import { t } from '../../i18n/index.js';
import {
  siteHomePage, howItWorksPage, forSeniorsPage, forVolunteersPage, forFamiliesPage, languagesPage, safetyPage, aboutPage,
} from './pages.js';

// path -> [title key, nav key (marks the header link with aria-current), page]
export const SITE_PAGES = {
  '/': ['site.home.title', 'site-home', siteHomePage],
  '/how-it-works': ['site.how.title', 'site-how', howItWorksPage],
  '/for-seniors': ['site.seniors.title', 'site-seniors', forSeniorsPage],
  '/for-volunteers': ['site.volunteers.title', 'site-volunteers', forVolunteersPage],
  '/for-families': ['site.families.title', 'site-families', forFamiliesPage],
  '/languages': ['site.languages.title', 'site-languages', languagesPage],
  '/safety': ['site.safety.title', 'site-safety', safetyPage],
  '/about': ['site.about.title', 'site-about', aboutPage],
};

export function registerSite(router, ctx) {
  for (const [path, [titleKey, active, page]] of Object.entries(SITE_PAGES)) {
    router.get(path, (req, res) => ctx.render(req, res, { title: t(titleKey), active, body: page(), wide: true }));
  }
}
