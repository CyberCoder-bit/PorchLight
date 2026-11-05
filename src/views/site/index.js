// The public website (v2): what a signed-out visitor sees.
// Routes: /, /how-it-works, /for-seniors, /for-volunteers,
// /for-families, /languages, /safety, /about. Who may open them is in
// ./access.js (everyone, signed in or not).
//
// registerSite() is called in createApp() after the app's own routes and
// before registerRoles() (which must stay last).

export function registerSite(router, ctx) {
  // TEMPORARY placeholder until the public home is built: shows the old
  // coordinator home so nothing breaks. The public website replaces this.
  router.get('/', (req, res) => ctx.coordinatorHome(req, res));
}
