# PorchLight

**Volunteer companions, AI conversation starters, and an early-warning dashboard for isolated seniors in Carmel, Indiana.**

Prototype for the Nextech CSforGood 2026 competition. [TEAM: team name, school]

![Family dashboard showing one senior flagged for isolation risk](docs/screenshots/dashboard.png)

PorchLight pairs older adults with volunteer "Porch Light" companions (high school students, retirees, neighbors) for regular phone calls, video calls, and visits. Before each call, the volunteer gets three personalized conversation starters. Families get a dashboard that shows how often their loved one is hearing from someone and raises a flag when contact starts to drop off, before isolation turns into a crisis.

---

## Quick start

You need **Node.js 20 or newer** ([download the LTS version](https://nodejs.org)). It was tested on Node 24. Check with `node --version`.

```bash
npm start
```

Then open **http://localhost:3000**.

That's the whole setup. There's no `npm install`, database, account, or API key to set up. On first run, PorchLight creates `data/db.json` with four fictional seniors and four fictional volunteers, so the demo works right away.

| Command | What it does |
|---|---|
| `npm start` | Run the app at http://localhost:3000 |
| `npm test` | Run the automated tests (41 tests) |
| `npm run reset` | Reset the demo data, with dates moved so the story starts today |
| `npm install` | **Optional.** Only needed for LIVE AI mode (installs the official Anthropic SDK) or for Cloudflare (installs wrangler) |
| `npm run dev` | Run the Cloudflare Workers version locally at http://localhost:8787 |
| `npm run deploy` | Put PorchLight on the internet with Cloudflare Workers (see below) |

**Port 3000 busy?** Run `PORT=3001 npm start` (on Windows PowerShell: `$env:PORT=3001; npm start`).

## Put it on the internet (Cloudflare Workers)

The exact same app also runs on Cloudflare Workers, on the free plan. Pages
are served by a Worker (`src/worker.js`), and the data lives in a Durable
Object, a single always-consistent piece of storage, instead of `data/db.json`.

```bash
npm install            # one time: installs wrangler (and the Anthropic SDK)
npx wrangler login     # one time: opens a browser so you can sign in to Cloudflare
npm run deploy         # prints your URL, like https://porchlight.<your-subdomain>.workers.dev
```

- **Optional LIVE mode:** `npx wrangler secret put ANTHROPIC_API_KEY`, then deploy again.
- **Run `npm install` and `wrangler` on the same system you'll deploy from.**
  wrangler includes a native program, so a `node_modules` folder installed in
  WSL won't work from Windows PowerShell, and vice versa.
- **Times stay in Carmel time.** Cloudflare's servers run on UTC, so every date
  and time in PorchLight goes through `src/tz.js`, which always uses Indiana
  time. A call scheduled for 4:00 PM is 4:00 PM in Carmel, wherever the server is.
- **Auto-deploy on every push:** in the Cloudflare dashboard, go to Workers &
  Pages → Create → Import a repository, pick this GitHub repo, and keep the
  deploy command `npx wrangler deploy`.
- There's no login yet (see "Prototype limitations"), so anyone with the link
  can edit or reset the demo data. That's fine for fictional demo data, but
  don't put real people's information in a public deployment.

## A 3-minute demo

1. **Family Dashboard.** Harold ("Hal") is flagged **Isolation risk** with **Contact dropping**: twice-a-week visits faded to nothing, and his last visit was 12 days ago. Eugene ("Gene") just signed up and **needs a companion**.
2. **Match → Find a companion for Gene.** Sam Rivera is the best match at 21 points. The page shows exactly why, and why two other volunteers were *not* suggested (one is at capacity, one has no overlapping free time). Click **Match Gene with Sam**.
3. **Calls & Visits.** Schedule Gene's next call, and log the first one he just had ("Log one that already happened"). Every entry is saved with a timestamp.
4. **Get conversation sparks.** On Gene's profile you get three starters built from his interests (fishing, cars, technology…) and the fact that this is a first call. **Show different sparks** gives a new set.
5. **Back to the dashboard.** Gene went from **Needs a companion** to **Check in soon** (matched, first call pending) and, once the call was logged, to **Connected**. Change the alert setting from 7 to 4 days, and Rosa flips to **Isolation risk**. Families can set the threshold that fits their loved one.
6. **Text size.** Try **A++** in the header. Every page is built for large text, keyboard use, and screen readers.

Use **Reset demo data** (page footer) between run-throughs.

## Features

| Requirement | Where it lives |
|---|---|
| Senior profiles: name, interests, availability, contact method | `/seniors`, code in `src/views/pages/seniors.js` |
| Volunteer profiles: availability, interests, assigned seniors | `/volunteers`, code in `src/views/pages/volunteers.js` |
| Rule-based matching by shared interests and overlapping availability | `/match`, logic in `src/matching.js` |
| Scheduling and logging calls and visits, with timestamps | `/contacts`, routes in `src/app.js` |
| AI Conversation Spark (MOCK_MODE and LIVE_MODE) | Senior profile, logic in `src/sparks/` |
| Caregiver dashboard: check-ins over time and an isolation-risk flag with a configurable threshold | `/dashboard`, logic in `src/risk.js`, chart in `src/views/chart.js` |
| Demo-ready seed data (4 seniors, 4 volunteers, ~10 weeks of history) | `src/seed.js` |

## Tech stack, and why

| Layer | Choice |
|---|---|
| Server | A ~150-line router on Web-standard Request/Response (`src/http.js`), run by Node's built-in `http` module locally (`src/node-server.js`) or by Cloudflare Workers (`src/worker.js`) |
| Pages | Server-rendered HTML (`src/views/`) with plain CSS and a tiny optional script |
| Data | One JSON document: `data/db.json` locally (written atomically), Durable Object storage on Cloudflare |
| Chart | Inline SVG drawn on the server (no chart library) |
| AI (optional) | Claude through the official `@anthropic-ai/sdk` |
| Tests | Node's built-in test runner (`node --test`) |

We optimized for one thing: **it has to work on a judge's laptop on the first try, even on a locked-down school network.**

- **No required dependencies.** Core features use only what ships with Node.js, so `npm start` works without downloading anything. The Anthropic SDK is the only package, and it's loaded only when LIVE mode is turned on.
- **Server-rendered HTML instead of a JavaScript single-page app.** Seniors are our main users. Plain HTML pages with real forms and labels work with screen readers, keyboard navigation, browser zoom, and old browsers, and they still work if JavaScript fails. Every form uses the Post/Redirect/Get pattern, so pressing Refresh never submits a form twice.
- **A JSON file instead of a database.** For a prototype with a few dozen records, it's the most reliable option: nothing to install, and judges can open the file and read the data. Writes go to a temp file and are then renamed, so a crash can't corrupt it.

What we considered and didn't pick:
- **Express.** It needs `npm install`.
- **SQLite.** The native modules can fail to build, and Node's built-in SQLite isn't in every Node version yet.
- **Next.js.** Heavy for a 2-day build.
- **Browser-only localStorage.** The Claude API key would have to live in the browser, where anyone could read it.

## Conversation Spark: MOCK_MODE and LIVE_MODE

Many of our volunteers are teenagers. Opening a conversation with someone 60 years older can feel awkward, and awkward calls are the ones that stop happening. A **Conversation Spark** is three short, personal starters, built from:

- the senior's **stored interests** and "about me" text,
- the **date of their last contact.** Recent calls get a follow-up opener, about a week gets an easy catch-up, and a long gap gets a warm "I've missed our chats" that never makes the senior feel guilty. A first call gets a first-conversation opener,
- the season, plus a few Carmel-specific touches (Monon Trail, Farmers Market, Christkindlmarkt, the Palladium, the Indy 500).

| | MOCK_MODE (default) | LIVE_MODE |
|---|---|---|
| Needs internet or a key? | No | Yes: `ANTHROPIC_API_KEY` |
| How it works | Hand-written template bank (`src/sparks/templates.js`), picked by a seeded random generator | Claude writes the sparks (`src/sparks/live.js`) |
| Repeatable? | Yes. The same inputs always give the same sparks; **Show different sparks** moves to the next variant | No. Each request is fresh |
| If something fails | n/a | Automatically falls back to MOCK sparks and says so on the page |

**How MOCK mode stays deterministic and still varies:** the senior's ID, interests, last-contact date, season, and a variant number are hashed (FNV-1a) into a seed for a small pseudo-random generator (mulberry32). That generator picks the templates. Different seniors and different gaps since the last call give different sparks, and the same situation always gives the same ones. That makes the demo repeatable and the feature testable.

### Turning on LIVE mode

```bash
npm install                 # installs @anthropic-ai/sdk (one time)
cp .env.example .env        # then paste your key into .env
npm start
```

Or skip the `.env` file and run `ANTHROPIC_API_KEY=sk-ant-... npm start`. The header badge changes to **AI: Live (Claude)**, and `/about-ai` shows the active mode and why it was chosen.

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | Your Claude API key, from [console.anthropic.com](https://console.anthropic.com) |
| `SPARK_MODE` | `auto` | `auto` = LIVE if a key is set and the SDK is installed, otherwise MOCK. `mock` = always offline. `live` = ask for LIVE and warn if it can't run |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Which Claude model writes the sparks |
| `RISK_THRESHOLD_DAYS` | `7` | Starting value for the dashboard alert setting |
| `PORT` | `3000` | Web server port |

Details of the live call:
- It uses `messages.create` with **structured outputs** (a JSON schema), so the reply always has the right shape.
- It runs at `effort: "low"`, which keeps it quick for short creative text.
- The timeout is 20 seconds, with one retry.
- If the API declines, times out, rejects the key, or returns something unexpected, the volunteer still gets offline sparks with a short note explaining why.
- Each request is a few hundred tokens, well under one cent at current Sonnet pricing.

**Privacy:** the only things sent to the API are the senior's preferred first name, interest labels, "about me" text, days since the last contact, and today's date and season. Family contacts, phone numbers, and volunteer call notes are never sent.

## How matching works (`src/matching.js`)

1. **Must-haves.** A volunteer is only suggested if they:
   - have room (fewer seniors than the maximum they signed up for),
   - share at least one weekly time slot with the senior,
   - offer the senior's preferred contact method (phone, video, or visit).
2. **Points.**
   - **+3** for each shared interest. Common ground makes conversations easier, and good conversations keep people calling.
   - **+2** for each shared time slot, counting at most 5, so someone who is free all the time can't outrank someone with real common interests.
   - **+1** if the volunteer has no seniors yet, which spreads the work around.
3. **Ranking.** Highest score first. Ties go to the volunteer with fewer seniors, then alphabetical order.

The match page shows the full points breakdown and the reason each excluded volunteer was left out. A coordinator always makes the final choice.

## How the isolation-risk flag works (`src/risk.js`)

Only **completed** calls and visits count. Scheduled and missed ones don't.

| Flag | Rule (default threshold = 7 days) |
|---|---|
| ⚠ **Isolation risk** | No completed contact for more than the threshold (8+ days) |
| ◷ **Check in soon** | Within 2 days of the threshold (5 to 7 days), or newly matched and still waiting for the first call |
| ✚ **Needs a companion** | Not matched with a volunteer |
| ✓ **Connected** | Regular contact is happening |
| ↓ **Contact dropping** (extra flag) | Check-ins in the last 4 weeks fell to half or less of the 4 weeks before |

The trend flag catches the slow fade. Hal is flagged even though his volunteer is still "assigned," because what matters is whether calls are actually happening. Families can change the threshold (1 to 60 days) on the dashboard.

Each senior's card has a chart of completed check-ins per week for 8 weeks, with a "Show as a table" view of the same numbers for screen readers and anyone who prefers text.

## Accessibility

Seniors are the primary users, so accessibility was a requirement from the start:

- 20px base text, with a **text-size control** (A / A+ / A++) that works without JavaScript
- Text contrast meets **WCAG AAA (7:1)**; status is always shown with an icon **and** words, never color alone
- Full keyboard support, a "Skip to main content" link, and a thick, high-visibility focus ring
- Every input has a visible label. Checkbox groups use `fieldset`/`legend`. Form errors appear in a summary at the top that receives focus and links to each field
- Click targets are at least 44px. Layouts reflow down to phone width, even at the largest text size
- Charts have a text summary and a data table
- Respects "reduced motion" and Windows High Contrast mode
- Lighthouse accessibility score: **100** on the home page, dashboard, senior profile, add-senior form, match page, and calls page (audited with a mix of desktop and mobile settings)

## Testing

```bash
npm test
```

The 41 tests cover:
- matching rules and ranking,
- risk thresholds, trend detection, and weekly chart buckets,
- MOCK sparks (always 3, deterministic, varied, gap-aware),
- LIVE mode against a local fake Claude server. These check the request format, privacy (no caregiver details or notes are sent), and fallback on a bad key, a refusal, bad output, or no network,
- a full end-to-end run of the app: every page loads, then match → schedule → complete → sparks → dashboard, plus validation, XSS escaping, settings, and reset.

The LIVE tests are skipped automatically if `npm install` hasn't been run.

## Project structure

```
server.js              Local entry point (npm start)
wrangler.jsonc         Cloudflare Workers settings (npm run deploy)
src/
  app.js               All routes and form validation
  http.js              Tiny web framework on Web-standard Request/Response
  node-server.js       Runs the app on Node's http module and serves /public
  worker.js            Runs the app on Cloudflare Workers + a Durable Object
  store-core.js        Data storage, independent of where the data lives
  store.js             JSON file storage for local runs
  app-config.js        Settings shared by Node and Cloudflare (AI mode, threshold)
  config.js            Local settings (.env file, port, data file)
  tz.js                Carmel, Indiana time zone helpers
  seed.js              Fictional demo data, dated relative to today
  vocab.js             Shared interest list, time slots, contact methods
  matching.js          Matching rules
  risk.js              Isolation-risk rules and weekly counts
  sparks/              Conversation Spark: index (mode switch), mock, templates, live (Claude)
  views/               HTML pages, layout, components, SVG chart
public/                CSS, small optional script, icon
test/                  Automated tests
docs/                  Architecture diagram and competition write-ups
```

## Prototype limitations

- **No login or roles.** Everyone can see every screen. A real deployment needs accounts for seniors, volunteers, families, and coordinators, with each person seeing only what they should.
- **One shared data document.** Locally it's a JSON file; on Cloudflare it's one Durable Object. Both are simple and consistent, but a large program would move to real database tables (Cloudflare D1 or Postgres).
- **No volunteer screening.** A real program needs background checks and training before volunteers contact seniors.
- **Notifications are on-screen only.** Families have to open the dashboard to see a flag.

## Future work

- **SMS and email reminders** for upcoming calls, and **alerts to families** when a flag goes up
- **Partnerships with real volunteer organizations** (school service clubs, senior centers, CICOA Aging & In-Home Solutions, faith communities) to recruit, screen, and train companions
- **Multi-language support,** starting with Spanish, for both the interface and the conversation sparks
- **Phone-only access** for seniors without internet (an automated "press 1 to request a call" line)
- **Accounts and privacy controls** and a real database, so the Cloudflare deployment can hold real (not demo) data
- Smarter matching that learns from which pairs keep talking, with a human always making the final call

## About the data

Every person in the demo data is **fictional**. Names, ages, histories, and families are made up for the demo.

## Credits

[TEAM: team member names and roles. See `docs/part2_narrative.md`.]

