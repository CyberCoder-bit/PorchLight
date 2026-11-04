# PorchLight

**Helping Indiana communities keep older adults connected: volunteer companions, AI conversation
starters, and an early-warning dashboard for families. Built for any Indiana town; the demo data is
set in Carmel (Hamilton County).**

Prototype for the Nextech CSforGood 2026 competition (grades 9-12). [TEAM: team name, school]

![Family dashboard showing one senior flagged for isolation risk](docs/screenshots/dashboard.png)

---

## For judges: start here

**What it is.** PorchLight helps a volunteer program keep older adults from slipping into isolation.
It matches each senior with a volunteer companion, gives the volunteer three conversation starters
before every call, and shows the family a dashboard that flags when calls and visits stop happening,
in any Indiana community, starting with Carmel.

**Run it in 3 commands.** You need [Node.js](https://nodejs.org) 20 or newer. There's nothing else to
install: no `npm install`, database, account, or API key.

```bash
git clone https://github.com/CyberCoder-bit/PorchLight.git
cd PorchLight
npm start
```

Then open **http://localhost:3000**. Port 3000 busy? Run `PORT=3001 npm start` (Windows PowerShell:
`$env:PORT=3001; npm start`).

[TEAM: if you deploy to Cloudflare, add "Or try it online:" and your workers.dev URL here.
Otherwise delete this line.]

### The 2-minute demo

These are the same steps as the in-app tour at **/tour**. <!-- VERIFY AFTER MERGE: match the /tour steps and wording exactly -->

1. **Reset demo data** (tour step 1, or the page footer). The dates move so the story starts today.
   Everyone in the demo is fictional.
2. **Family Dashboard.** Hal is flagged **Isolation risk** and **Contact dropping**: his volunteer's
   twice-a-week visits faded, and his last visit was 12 days ago.
3. **Needs attention** (`/attention`). Hal's reason is written in plain English, with a suggested
   next step. Schedule his next visit from here. <!-- VERIFY AFTER MERGE -->
4. **My week** for his volunteer, Ethan (`/volunteers/v-ethan/week`). Hal's visit is listed with
   conversation sparks ready. Click **Log this call**. <!-- VERIFY AFTER MERGE -->
5. **Back to the dashboard.** Hal is no longer at Isolation risk, because a visit actually happened.
6. **Match → Find a companion for Gene.** Sam is the best match at 21 points, and the page shows why
   the other volunteers weren't suggested.
7. **Get help in Indiana** (`/help`), then **A++** in the header for the largest text.
   <!-- VERIFY AFTER MERGE -->

### Rubric map

| # | Rubric criterion | Where to see it |
|---|---|---|
| 1 | Brief description (350 characters) | [docs/part1_description.md](docs/part1_description.md) |
| 2 | Narrative: market research | [Narrative](docs/part2_narrative.md), "Market research"; full data, sources, and interview guide in [docs/research.md](docs/research.md) |
| 3 | Narrative: how the project solves the challenge | Narrative, "How PorchLight solves the challenge"; demo steps 2-5 above |
| 4 | Narrative: how technology was used | Narrative, "How technology was used"; [Tech stack](#tech-stack-and-why) and [Built for all of Indiana](#built-for-all-of-indiana-launch-in-another-town) below; [docs/architecture-diagram.md](docs/architecture-diagram.md) |
| 5 | Narrative: why and how AI was used | Narrative, "Why and how AI was used"; the `/about-ai` page; [Conversation Spark](#conversation-spark-mock_mode-and-live_mode) below |
| 6 | Narrative: team member roles | Narrative, "Team member roles" |
| 7 | Video (10 minutes or less, including future features) | [docs/part3_video_script.md](docs/part3_video_script.md); [TEAM: video link] |
| 8 | Functional solution | `npm start` and the demo above; `npm test` |
| 9 | Source code and project documentation | This repository: `src/`, `test/`, this README, and `docs/` |
| 10 | CS for Good impact | Narrative; the gap PorchLight fills in [docs/research.md](docs/research.md), section 3; the `/help` page |

---

## What PorchLight does

PorchLight pairs older adults with volunteer "Porch Light" companions (high school students,
retirees, neighbors) for regular phone calls, video calls, and visits. It works as a loop:

1. **Match.** A coordinator pairs each senior with a volunteer who shares their interests and free
   time.
2. **Connect.** Calls and visits are scheduled and logged, with timestamps.
3. **Spark.** Before each call, the volunteer gets three personal conversation starters.
4. **Watch.** A family dashboard counts the calls and visits that actually happened and raises a flag
   when contact starts to drop off, before isolation turns into a crisis.

It's designed for any Indiana community. Everything that changes from town to town (time zone, local
touches, local help) lives in one community profile, `src/community.js`. The demo data is set in
Carmel. PorchLight is a prototype: it isn't in use by any real program, and it has no partners or
pilots yet.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Run the app at http://localhost:3000 |
| `npm test` | Run the automated tests |
| `npm run reset` | Reset the demo data, with dates moved so the story starts today |
| `npm install` | **Optional.** Only needed for LIVE AI mode (installs the official Anthropic SDK) or for Cloudflare (installs wrangler) |
| `npm run dev` | Run the Cloudflare Workers version locally at http://localhost:8787 |
| `npm run deploy` | Put PorchLight on the internet with Cloudflare Workers (see below) |

It was tested on Node 24. Check your version with `node --version`. On first run, PorchLight creates
`data/db.json` with four fictional seniors and four fictional volunteers, so the demo works right
away.

## Put it on the internet (Cloudflare Workers)

The exact same app also runs on Cloudflare Workers, on the free plan. Pages are served by a Worker
(`src/worker.js`), and the data lives in a Durable Object, a single always-consistent piece of
storage, instead of `data/db.json`.

```bash
npm install            # one time: installs wrangler (and the Anthropic SDK)
npx wrangler login     # one time: opens a browser so you can sign in to Cloudflare
npm run deploy         # prints your URL, like https://porchlight.<your-subdomain>.workers.dev
```

- **Optional LIVE mode:** `npx wrangler secret put ANTHROPIC_API_KEY`, then deploy again.
- **Run `npm install` and `wrangler` on the same system you'll deploy from.** wrangler includes a
  native program, so a `node_modules` folder installed in WSL won't work from Windows PowerShell,
  and vice versa.
- **Times stay in the community's local time.** Cloudflare's servers run on UTC, so every date and
  time in PorchLight goes through `src/tz.js`, which uses the time zone in the community profile. A
  call scheduled for 4:00 PM is 4:00 PM in Carmel, wherever the server is.
- **Auto-deploy on every push:** in the Cloudflare dashboard, go to Workers & Pages → Create →
  Import a repository, pick this GitHub repo, and keep the deploy command `npx wrangler deploy`.
- There's no login yet (see "Prototype limitations"), so anyone with the link can edit or reset the
  demo data. That's fine for fictional demo data, but don't put real people's information in a
  public deployment.

## A longer walkthrough

1. **Family Dashboard.** Harold ("Hal") is flagged **Isolation risk** with **Contact dropping**:
   twice-a-week visits faded to nothing, and his last visit was 12 days ago. Eugene ("Gene") just
   signed up and **needs a companion**.
2. **Needs attention.** The coordinator's list shows every senior who needs help, why (in plain
   English), and one suggested next step: message the volunteer, reschedule, re-match, contact
   family, or call local help. <!-- VERIFY AFTER MERGE -->
3. **Match → Find a companion for Gene.** Sam Rivera is the best match at 21 points. The page shows
   exactly why, and why two other volunteers were *not* suggested (one is at capacity, one has no
   overlapping free time). Click **Match Gene with Sam**.
4. **Calls & Visits.** Schedule Gene's next call, and log the first one he just had ("Log one that
   already happened"). Every entry is saved with a timestamp.
5. **My week.** Each volunteer sees the next 7 days of calls in local time, with each senior's latest
   sparks inline, a one-click **Log this call**, and **Mark missed** with a reason.
   <!-- VERIFY AFTER MERGE -->
6. **Get conversation sparks.** On Gene's profile you get three starters built from his interests
   (fishing, cars, technology…) and the fact that this is a first call. **Show different sparks**
   gives a new set.
7. **Back to the dashboard.** Gene went from **Needs a companion** to **Check in soon** (matched,
   first call pending) and, once the call was logged, to **Connected**. Change the alert setting
   from 7 to 4 days, and Rosa flips to **Isolation risk**. Families can set the threshold that fits
   their loved one.
8. **Get help in Indiana.** The local Area Agency on Aging (CICOA for Hamilton County), Indiana 211,
   and 911, each with the official source and the date it was checked. <!-- VERIFY AFTER MERGE -->
9. **Text size.** Try **A++** in the header. Every page is built for large text, keyboard use, and
   screen readers.

Use **Reset demo data** (page footer) between run-throughs.

## Features

| Feature | Where it lives |
|---|---|
| Senior profiles: name, interests, availability, contact method | `/seniors`, code in `src/views/pages/seniors.js` |
| Volunteer profiles: availability, interests, assigned seniors | `/volunteers`, code in `src/views/pages/volunteers.js` |
| Rule-based matching by shared interests and overlapping availability | `/match`, logic in `src/matching.js` |
| Scheduling and logging calls and visits, with timestamps (missed calls can record a reason) | `/contacts`, routes in `src/app.js` |
| AI Conversation Spark (MOCK_MODE and LIVE_MODE) | Senior profile, logic in `src/sparks/` |
| Caregiver dashboard: check-ins over time and an isolation-risk flag with a configurable threshold | `/dashboard`, logic in `src/risk.js`, chart in `src/views/chart.js` |
| Coordinator "Needs attention" queue, with plain-English reasons, a suggested next step, and re-matching | `/attention`, code in `src/features/` <!-- VERIFY AFTER MERGE --> |
| Volunteer "My week," with sparks inline, one-click "Log this call," and "Mark missed" with a reason | `/volunteers/:id/week`, code in `src/features/` <!-- VERIFY AFTER MERGE --> |
| Printable weekly family summary, with plain text to copy into a message | `/seniors/:id/summary` <!-- VERIFY AFTER MERGE: remove this row if it didn't ship --> |
| "Add to calendar" file for a scheduled call | `/contacts/:id/calendar.ics` <!-- VERIFY AFTER MERGE: remove this row if it didn't ship --> |
| "Get help in Indiana": local Area Agency on Aging, Indiana 211, and 911, with sources | `/help`, code in `src/indiana/` <!-- VERIFY AFTER MERGE --> |
| 2-minute judge demo tour | `/tour`, code in `src/views/pages/extra.js` <!-- VERIFY AFTER MERGE --> |
| One community profile per Indiana town (time zone, local touches, local help) | `src/community.js` |
| Demo-ready seed data (4 seniors, 4 volunteers, about 10 weeks of history) | `src/seed.js` |

## Built for all of Indiana: launch in another town

PorchLight is designed so a new Indiana community can start using it by adding a **community
profile**, without changing code all over the app. Everything that differs from town to town lives
in `src/community.js`:

| Field | What it holds | Carmel's value |
|---|---|---|
| `id`, `town`, `county`, `state` | Who the deployment serves | `carmel`, Carmel, Hamilton County, Indiana |
| `timeZone` | The time zone used for every date and time | `America/Indiana/Indianapolis` (Eastern) |
| `localTouches` | Short, real local references the offline conversation sparks can mention | Monon Trail, the Palladium, and others <!-- VERIFY AFTER MERGE --> |
| `help` | Local help resources, each with an official source and the date it was checked | CICOA Aging & In-Home Solutions <!-- VERIFY AFTER MERGE --> |

**Indiana has two time zones.** Most of Indiana uses Eastern time. Twelve counties use Central time:
Jasper, Lake, LaPorte, Newton, Porter, and Starke in the northwest, and Gibson, Perry, Posey,
Spencer, Vanderburgh, and Warrick in the southwest (source: the State of Indiana's
[time zone information page](https://faqs.in.gov/hc/en-us/articles/115005225448-Indiana-Time-Zone-Information),
checked Nov. 3, 2026). A community in one of those counties uses `America/Chicago`. The tests check
both zones on the 2026 daylight-saving days (March 8 and November 1). <!-- VERIFY AFTER MERGE -->

**To launch in another town:** <!-- VERIFY AFTER MERGE: fill in the exact steps once the profile format is merged -->

1. Copy the Carmel entry in `COMMUNITIES` in `src/community.js` and change the town, county, and
   time zone.
2. Add real local touches for the offline sparks, or leave them empty to use generic Indiana ones.
3. Look up the county's Area Agency on Aging on the
   [FSSA Area Agencies on Aging page](https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/) and
   add it to `help`, with the source URL and the date you checked it.
4. Point `COMMUNITY` at the new profile, then run `npm test` and `TZ=UTC npm test`.

## Tech stack, and why

| Layer | Choice |
|---|---|
| Server | A ~150-line router on Web-standard Request/Response (`src/http.js`), run by Node's built-in `http` module locally (`src/node-server.js`) or by Cloudflare Workers (`src/worker.js`) |
| Pages | Server-rendered HTML (`src/views/`) with plain CSS and a tiny optional script |
| Data | One JSON document: `data/db.json` locally (written atomically), Durable Object storage on Cloudflare |
| Time | One module (`src/tz.js`) that reads the community's time zone, so times are right on any server |
| Chart | Inline SVG drawn on the server (no chart library) |
| AI (optional) | Claude through the official `@anthropic-ai/sdk` |
| Tests | Node's built-in test runner (`node --test`) |

We optimized for one thing: **it has to work on a judge's laptop on the first try, even on a
locked-down school network.**

- **No required dependencies.** Core features use only what ships with Node.js, so `npm start` works
  without downloading anything. The Anthropic SDK is the only package, and it's loaded only when LIVE
  mode is turned on.
- **Server-rendered HTML instead of a JavaScript single-page app.** Seniors are our main users.
  Plain HTML pages with real forms and labels work with screen readers, keyboard navigation, browser
  zoom, and old browsers, and they still work if JavaScript fails. Every form uses the
  Post/Redirect/Get pattern, so pressing Refresh never submits a form twice.
- **A JSON file instead of a database.** For a prototype with a few dozen records, it's the most
  reliable option: nothing to install, and judges can open the file and read the data. Writes go to
  a temp file and are then renamed, so a crash can't corrupt it.

What we considered and didn't pick:
- **Express.** It needs `npm install`.
- **SQLite.** The native modules can fail to build, and Node's built-in SQLite isn't in every Node
  version yet.
- **Next.js.** Heavy for a 2-day build.
- **Browser-only localStorage.** The Claude API key would have to live in the browser, where anyone
  could read it.

## Conversation Spark: MOCK_MODE and LIVE_MODE

Many of our volunteers are teenagers. Opening a conversation with someone 60 years older can feel
awkward, and awkward calls are the ones that stop happening. A **Conversation Spark** is three short,
personal starters, built from:

- the senior's **stored interests** and "about me" text;
- the **date of their last contact.** Recent calls get a follow-up opener, about a week gets an easy
  catch-up, and a long gap gets a warm "I've missed our chats" that never makes the senior feel
  guilty. A first call gets a first-conversation opener;
- the season, plus local touches from the community profile (for Carmel: the Monon Trail, the
  Farmers Market, the Christkindlmarkt, the Palladium, and the Indy 500). <!-- VERIFY AFTER MERGE -->

| | MOCK_MODE (default) | LIVE_MODE |
|---|---|---|
| Needs internet or a key? | No | Yes: `ANTHROPIC_API_KEY` |
| How it works | Hand-written template bank (`src/sparks/templates.js`), picked by a seeded random generator | Claude writes the sparks (`src/sparks/live.js`) |
| Repeatable? | Yes. The same inputs always give the same sparks; **Show different sparks** moves to the next variant | No. Each request is fresh |
| If something fails | n/a | Automatically falls back to MOCK sparks and says so on the page |

**How MOCK mode stays deterministic and still varies:** the senior's ID, interests, last-contact
date, season, and a variant number are hashed (FNV-1a) into a seed for a small pseudo-random
generator (mulberry32). That generator picks the templates. Different seniors and different gaps
since the last call give different sparks, and the same situation always gives the same ones. That
makes the demo repeatable and the feature testable.

**Why AI is used only here:** matching, risk flags, the Needs attention queue, and help resources
are plain rules, on purpose. A coordinator can explain every match, a family can see exactly why a
flag went up, and each rule has an exact test.

### Turning on LIVE mode

```bash
npm install                 # installs @anthropic-ai/sdk (one time)
cp .env.example .env        # then paste your key into .env
npm start
```

Or skip the `.env` file and run `ANTHROPIC_API_KEY=sk-ant-... npm start`. The header badge changes
to **AI: Live (Claude)**, and `/about-ai` shows the active mode and why it was chosen.

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | Your Claude API key, from [console.anthropic.com](https://console.anthropic.com) |
| `SPARK_MODE` | `auto` | `auto` = LIVE if a key is set and the SDK is installed, otherwise MOCK. `mock` = always offline. `live` = ask for LIVE and warn if it can't run |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Which Claude model writes the sparks |
| `RISK_THRESHOLD_DAYS` | `7` | Starting value for the dashboard alert setting |
| `PORT` | `3000` | Web server port |

Details of the live call:
- It uses `messages.create` with **structured outputs** (a JSON schema), so the reply always has the
  right shape.
- It runs at `effort: "low"`, which keeps it quick for short creative text.
- The timeout is 20 seconds, with one retry.
- If the API declines, times out, rejects the key, or returns something unexpected, the volunteer
  still gets offline sparks with a short note explaining why.
- Each request is a few hundred tokens, well under one cent at current Sonnet pricing.

**Privacy:** the only things sent to the API are the senior's preferred first name, interest labels,
"about me" text, days since the last contact, the contact type, and today's date and season. Family
contacts, phone numbers, volunteer call notes, and missed-call reasons are never sent.

## How matching works (`src/matching.js`)

1. **Must-haves.** A volunteer is only suggested if they:
   - have room (fewer seniors than the maximum they signed up for),
   - share at least one weekly time slot with the senior,
   - offer the senior's preferred contact method (phone, video, or visit).
2. **Points.**
   - **+3** for each shared interest. Common ground makes conversations easier, and good
     conversations keep people calling.
   - **+2** for each shared time slot, counting at most 5, so someone who is free all the time can't
     outrank someone with real common interests.
   - **+1** if the volunteer has no seniors yet, which spreads the work around.
3. **Ranking.** Highest score first. Ties go to the volunteer with fewer seniors, then alphabetical
   order.

The match page shows the full points breakdown and the reason each excluded volunteer was left out.
A coordinator always makes the final choice.

## How the isolation-risk flag works (`src/risk.js`)

Only **completed** calls and visits count. Scheduled and missed ones don't.

| Flag | Rule (default threshold = 7 days) |
|---|---|
| ⚠ **Isolation risk** | No completed contact for more than the threshold (8+ days) |
| ◷ **Check in soon** | Within 2 days of the threshold (5 to 7 days), or newly matched and still waiting for the first call |
| ✚ **Needs a companion** | Not matched with a volunteer |
| ✓ **Connected** | Regular contact is happening |
| ↓ **Contact dropping** (extra flag) | Check-ins in the last 4 weeks fell to half or less of the 4 weeks before |

The trend flag catches the slow fade. Hal is flagged even though his volunteer is still "assigned,"
because what matters is whether calls are actually happening. Families can change the threshold (1
to 60 days) on the dashboard.

Each senior's card has a chart of completed check-ins per week for 8 weeks, with a "Show as a table"
view of the same numbers for screen readers and anyone who prefers text.

## Accessibility

Seniors are the primary users, so accessibility was a requirement from the start:

- 20px base text, with a **text-size control** (A / A+ / A++) that works without JavaScript
- Text contrast meets **WCAG AAA (7:1)**; status is always shown with an icon **and** words, never
  color alone
- Full keyboard support, a "Skip to main content" link, and a thick, high-visibility focus ring
- Every input has a visible label. Checkbox groups use `fieldset`/`legend`. Form errors appear in a
  summary at the top that receives focus and links to each field
- Click targets are at least 44px. Layouts reflow down to phone width, even at the largest text size
- Charts have a text summary and a data table
- Respects "reduced motion" and Windows High Contrast mode
- Lighthouse accessibility score: **100** on every page, at desktop width and at 375px
  <!-- VERIFY AFTER MERGE: confirm with the final Lighthouse run -->

## Testing

```bash
npm test                          # the full suite
TZ=UTC npm test                   # same results on a UTC server (like Cloudflare)
TZ=America/Los_Angeles npm test   # same results in any other time zone
```

The tests cover:
- matching rules and ranking;
- risk thresholds, trend detection, and weekly chart buckets;
- MOCK sparks (always 3, deterministic, varied, gap-aware);
- LIVE mode against a local fake Claude server. These check the request format, privacy (no
  caregiver details or notes are sent), and fallback on a bad key, a refusal, bad output, or no
  network;
- a full end-to-end run of the app: every page loads, then match → schedule → complete → sparks →
  dashboard, plus validation, XSS escaping, settings, missed-call reasons, and reset;
- both Indiana time zones on daylight-saving days, the Needs attention queue, My week, and the
  Get help in Indiana page <!-- VERIFY AFTER MERGE: test/indiana/, test/features/ -->;
- a link crawler that follows every link and form on every page and checks that none is broken.
  <!-- VERIFY AFTER MERGE: test/integration/links.test.js -->

The LIVE tests are skipped automatically if `npm install` hasn't been run.

## Project structure

```
server.js              Local entry point (npm start)
wrangler.jsonc         Cloudflare Workers settings (npm run deploy)
src/
  app.js               Core routes and form validation; registers the add-on modules below
  community.js         The community profile: town, county, time zone, local touches, local help
  features/            Needs attention queue, My week, and other day-to-day features
  indiana/             Get help in Indiana, and other community-specific pieces
  http.js              Tiny web framework on Web-standard Request/Response
  node-server.js       Runs the app on Node's http module and serves /public
  worker.js            Runs the app on Cloudflare Workers + a Durable Object
  store-core.js        Data storage, independent of where the data lives
  store.js             JSON file storage for local runs
  app-config.js        Settings shared by Node and Cloudflare (AI mode, threshold)
  config.js            Local settings (.env file, port, data file)
  tz.js                Time zone helpers (uses the community's time zone)
  seed.js              Fictional demo data, dated relative to today
  vocab.js             Shared interest list, time slots, contact methods, missed-call reasons
  matching.js          Matching rules
  risk.js              Isolation-risk rules and weekly counts
  sparks/              Conversation Spark: index (mode switch), mock, templates, live (Claude)
  views/               HTML pages, layout, components, SVG chart; pages/extra.js has the demo tour
public/                CSS, small optional script, icon
test/                  Automated tests
docs/                  Competition write-ups, research, architecture diagram
```

## Documentation

| Document | What's in it |
|---|---|
| [docs/part1_description.md](docs/part1_description.md) | Three options for the 350-character description, with measured counts |
| [docs/part2_narrative.md](docs/part2_narrative.md) | The 2-page narrative, using the rubric's headings |
| [docs/part3_video_script.md](docs/part3_video_script.md) | The video script, with timestamps and a shot list |
| [docs/research.md](docs/research.md) | Market research: data with exact quotes, existing programs, the gap, interview guide |
| [docs/architecture-diagram.md](docs/architecture-diagram.md) | Diagrams of the components, the loop, sparks, the risk flag, and the data model |
| [docs/TEAM-TODO.md](docs/TEAM-TODO.md) | What the team still needs to fill in before submitting |

## Prototype limitations

- **Not in use yet.** PorchLight hasn't been used by a real volunteer program, senior, or family. It
  has no partners or pilots.
- **No login or roles.** Everyone can see every screen. A real deployment needs accounts for
  seniors, volunteers, families, and coordinators, with each person seeing only what they should.
- **One shared data document.** Locally it's a JSON file; on Cloudflare it's one Durable Object. Both
  are simple and consistent, but a large program would move to real database tables (Cloudflare D1
  or Postgres).
- **No volunteer screening.** A real program needs background checks and training before volunteers
  contact seniors.
- **Notifications are on-screen only.** Families have to open the dashboard to see a flag.

## Future work

- **SMS and email reminders** for upcoming calls, and **alerts to families** when a flag goes up
- **Partnerships with real volunteer organizations** (school service clubs, senior centers, Area
  Agencies on Aging, faith communities) to recruit, screen, and train companions
- **More Indiana communities,** each with its own profile, including towns on Central time
- **Multi-language support,** starting with Spanish, for both the interface and the conversation
  sparks
- **Phone-only access** for seniors without internet (an automated "press 1 to request a call" line)
- **Accounts and privacy controls** and a real database, so the Cloudflare deployment can hold real
  (not demo) data
- Smarter matching that learns from which pairs keep talking, with a human always making the final
  call

## About the data

Every person in the demo data is **fictional**. Names, ages, histories, and families are made up for
the demo.

## Credits

[TEAM: team member names and roles. See `docs/part2_narrative.md`.]

