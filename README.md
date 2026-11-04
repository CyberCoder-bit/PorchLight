# PorchLight

**Helping Indiana communities keep older adults connected: volunteer companions, AI conversation
starters, and an early-warning dashboard for families. Built for any Indiana town; the demo data is
set in Carmel (Hamilton County).**

Prototype for the Nextech CSforGood 2026 competition (grades 9-12). [TEAM: team name, school]

![Family dashboard: Hal is flagged for isolation risk and dropping contact, and Gene is waiting for a companion](docs/screenshots/dashboard.png)

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

Open **http://localhost:3000/tour** (or **Take the 2-minute demo tour** on the home page). The tour
has these 7 steps, each with a button:

1. **Reset the demo data.** Start fresh, so every date in the story lines up with today. Everyone in
   the demo is made up.
2. **Family Dashboard: Hal is flagged.** Harold ("Hal") shows "Isolation risk" and "Contact
   dropping": no completed visit in 12 days, and only 3 check-ins in the last 4 weeks, down from 8.
3. **The Needs attention list.** Each senior who needs help has a plain-English reason and one
   suggested next step. Hal's is "Schedule a visit."
4. **Match Gene with a companion.** Sam scores highest for Eugene ("Gene"), with 21 points, and every
   volunteer who was left out is listed with the reason.
5. **Ethan's week.** A volunteer's calls for the next 7 days, with one click to log a call or mark it
   missed.
6. **Conversation sparks on Hal's profile.** Press "Get conversation sparks" for three suggested
   things to talk about, labeled with where they came from.
7. **Get help in Indiana, and bigger text.** Local help and Indiana 211 for this community. Then try
   **A++**: every page grows with the text.

The [video script](docs/part3_video_script.md) follows the same story further: schedule Hal's visit
from Needs attention, log it from Ethan's week, and watch Hal's Isolation risk flag clear.

### Rubric map

| # | Rubric criterion | Where to see it |
|---|---|---|
| 1 | Brief description (350 characters) | [docs/part1_description.md](docs/part1_description.md) |
| 2 | Narrative: market research | [Narrative](docs/part2_narrative.md), "Market research"; full data, sources, and interview guide in [docs/research.md](docs/research.md) |
| 3 | Narrative: how the project solves the challenge | Narrative, "How PorchLight solves the challenge"; tour steps 2-6 |
| 4 | Narrative: how technology was used | Narrative, "How technology was used"; [Tech stack](#tech-stack-and-why), [Launch in another Indiana town](#launch-in-another-indiana-town), and [Results](#results-at-the-time-of-writing) below; [docs/architecture-diagram.md](docs/architecture-diagram.md) |
| 5 | Narrative: why and how AI was used | Narrative, "Why and how AI was used"; the `/about-ai` page; [Conversation Spark](#conversation-spark-mock_mode-and-live_mode) below |
| 6 | Narrative: team member roles | Narrative, "Team member roles" |
| 7 | Video (10 minutes or less, including future features) | [docs/part3_video_script.md](docs/part3_video_script.md); [TEAM: video link] |
| 8 | Functional solution | `npm start` and the tour above; `npm test` |
| 9 | Source code and project documentation | This repository: `src/`, `test/`, this README, and `docs/` |
| 10 | CS for Good impact | Narrative; the gap PorchLight fills in [docs/research.md](docs/research.md), section 3; the `/help` page |

### Results at the time of writing

Measured on November 3, 2026, on the merged `polish` branch:

- **Automated tests:** 102 tests, all passing with `npm test`, `TZ=UTC npm test`, and
  `TZ=America/Los_Angeles npm test`. (The count will change as tests are added. Run `npm test` for
  the current number.)
- **Accessibility:** Google Lighthouse accessibility score of 100 on the 13 core pages, at 1280px wide
  and at 375px wide with A++ text. We re-checked `/attention`,
  `/help`, `/volunteers/v-ethan/week`, and `/seniors/s-harold/summary` at 375px with A++: 100, with
  no sideways scrolling.
- **Two runtimes:** Node (`npm start`) and Cloudflare Workers (`npx wrangler dev`) returned identical
  HTML for `/dashboard`, `/attention`, `/volunteers/v-ethan/week`, `/seniors/s-harold/summary`, and
  `/help`.

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
touches, and local help) lives in one community profile, `src/community.js`. The demo data is set in
Carmel. PorchLight is a prototype: no real program uses it, and it has no partners or pilots yet.

## Screenshots

All taken from a fresh demo reset on November 3, 2026.

| | |
|---|---|
| ![Home page: "Leave the porch light on for older neighbors," with the 2-minute tour button and the 4-step loop](docs/screenshots/home.png) | ![The 2-minute demo tour, step 1: reset the demo data](docs/screenshots/tour.png) |
| Home | The 2-minute demo tour |
| ![Needs attention: Hal, with his reason, his missed visit ("Volunteer had a conflict"), and the next step "Schedule a visit"](docs/screenshots/attention.png) | ![Ethan's week: Hal's Thursday visit with conversation sparks shown inline](docs/screenshots/week.png) |
| Needs attention | My week (Ethan) |
| ![Conversation sparks for Hal, each with what it was based on, labeled as suggestions from the offline mode](docs/screenshots/sparks.png) | ![Match page for Gene: interests, availability, and suggested companions](docs/screenshots/match.png) |
| Conversation sparks | Matching Gene |
| ![Get help in Indiana: the 911 safety line, with its source and the date it was checked](docs/screenshots/help.png) | ![Weekly family summary for Hal: Isolation risk and Contact dropping, with counts and dates](docs/screenshots/summary.png) |
| Get help in Indiana | Weekly family summary |
| ![Family dashboard on a 375px phone screen with A++ text](docs/screenshots/dashboard-375-xl.png) | ![Needs attention on a 375px phone screen with A++ text](docs/screenshots/attention-375-xl.png) |
| Dashboard, 375px wide, A++ | Needs attention, 375px wide, A++ |

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
   twice-a-week visits faded, a visit was missed because his volunteer had a conflict, and his last
   visit was 12 days ago. Eugene ("Gene") just signed up and **needs a companion**. The line under
   the tiles reads "Right now, 2 seniors need attention: 1 at isolation risk, 1 waiting for a
   companion."
2. **Needs attention** (`/attention`). The coordinator's list shows each senior who needs help, why,
   any missed calls with their reasons, and one suggested next step chosen by fixed rules: find a
   companion, find a new companion, get local help, let the family know, schedule a call, or remind
   the volunteer. Secondary buttons offer **Schedule a call**, **Find a new companion**, and **Family
   summary**. For Hal, the next step is **Schedule a visit**. Schedule one for a day when Hal and
   Ethan are both free (Tuesday, Thursday, Saturday, or Sunday afternoon).
3. **My week** (`/volunteers/v-ethan/week`). Ethan sees his calls and visits for the next 7 days in
   Carmel time. Press **Get conversation sparks for Hal**, and you come back to My week with the
   sparks shown under Hal's visit. Press **Log this visit**: it's recorded as happening now. (Each
   call also has **Mark missed** with a reason: no answer, senior was unavailable, volunteer had a
   conflict, or other, plus an optional note. A "Did these calls happen?" section lists past calls
   that nobody marked.)
4. **Back to the dashboard.** Hal is now **Connected**, because a visit actually happened today.
   **Contact dropping** stays until regular visits come back, since one visit doesn't fix a 4-week
   trend.
5. **Match → Find a companion for Gene.** Sam Rivera is the best match at 21 points. The page shows
   exactly why, and why two other volunteers were *not* suggested (Ethan is at capacity, and Linda
   has no overlapping free time). Click **Match Gene with Sam**.
6. **Calls & Visits.** Schedule Gene's first call. Upcoming calls have an **Add to calendar** link
   that downloads a calendar file.
7. **Weekly family summary** (`/seniors/s-harold/summary`). A printable one-page update with counts
   and dates only (never call notes), plus a box of plain text to paste into a message to a brother
   or sister.
8. **Alert setting.** On the dashboard, change the setting from 7 to 4 days, and Rosa flips to
   **Isolation risk**. Families choose the threshold that fits their loved one.
9. **Get help in Indiana** (`/help`). The 911 safety line, a "Which one should I call?" guide,
   CICOA Aging & In-Home Solutions (Hamilton County's Area Agency on Aging), Indiana 211, and the
   state's list of Area Agencies on Aging for every other county. Each one shows its official source
   and the date it was checked.
10. **Text size.** Try **A++** in the header. Every page is built for large text, keyboard use, and
    screen readers.

Use **Reset demo data** (page footer, or tour step 1) between run-throughs.

**If a companion can't continue:** on Needs attention, **Find a new companion** opens a confirm page
(`/attention/:seniorId/rematch`) that shows the match's history. Ending the match keeps every past
call and takes you to the Match page. (In the demo data, Ethan is the only volunteer who makes
visits when Hal is free, so the Match page would suggest Ethan again.)

## Features

| Feature | Where it lives |
|---|---|
| Senior profiles: name, interests, availability, contact method | `/seniors`, code in `src/views/pages/seniors.js` |
| Volunteer profiles: availability, interests, assigned seniors | `/volunteers`, code in `src/views/pages/volunteers.js` |
| Rule-based matching by shared interests and overlapping availability | `/match`, logic in `src/matching.js` |
| Scheduling and logging calls and visits, with timestamps; missed calls can record a reason | `/contacts`, routes in `src/app.js` |
| AI Conversation Spark (MOCK_MODE and LIVE_MODE), localized for each community | Senior profile and My week, logic in `src/sparks/` |
| Family dashboard: check-ins over time and an isolation-risk flag with a configurable threshold | `/dashboard`, logic in `src/risk.js`, chart in `src/views/chart.js` |
| Coordinator "Needs attention" list: plain-English reasons, missed calls with reasons, one suggested next step | `/attention`, logic in `src/features/attention.js` |
| Re-match confirm page (ends a match, keeps all history) | `/attention/:seniorId/rematch` |
| Volunteer "My week": next 7 days, sparks inline, one-click "Log this call/visit," "Mark missed" with a reason, and "Did these calls happen?" | `/volunteers/:id/week`, logic in `src/features/week.js` |
| Printable weekly family summary, with plain text to copy into a message | `/seniors/:id/summary`, logic in `src/features/summary.js` |
| "Add to calendar" file for a scheduled call | `/contacts/:id/calendar.ics`, logic in `src/features/calendar.js` |
| "Get help in Indiana": 911, the local Area Agency on Aging, Indiana 211, and the statewide list, with sources and dates | `/help`, code in `src/indiana/help-page.js` |
| 2-minute judge demo tour | `/tour`, code in `src/views/pages/extra.js` |
| One community profile per Indiana town (time zone, local touches, local help), with a Central-time sample | `src/community.js` |
| Correct times in both Indiana time zones, including daylight-saving days | `src/tz.js` |
| Print stylesheet (navigation and buttons hidden, key link URLs shown) | `public/styles.css` |
| Demo-ready seed data (4 seniors, 4 volunteers, about 10 weeks of history) | `src/seed.js` |

## Launch in another Indiana town

PorchLight is designed so a new Indiana community can start using it by adding a **community
profile**, without changing code all over the app. Everything that differs from town to town lives
in `src/community.js`:

| Field | What it holds | Carmel's value |
|---|---|---|
| `id`, `town`, `county`, `state` | Who the deployment serves | `carmel`, Carmel, Hamilton County, Indiana |
| `timeZone` | The time zone used for every date and time | `America/Indiana/Indianapolis` (Eastern) |
| `localTouches` | Real local places and events the offline sparks can mention | The Monon Trail, the Palladium, the Carmel Farmers Market, the Christkindlmarkt, and others |
| `help` | The community's Area Agency on Aging, with every phone number's official source and the date it was checked | CICOA Aging & In-Home Solutions |

**Indiana has two time zones.** Most counties use Eastern time. Twelve use Central time: Jasper, Lake,
LaPorte, Newton, Porter, and Starke in the northwest, and Gibson, Perry, Posey, Spencer, Vanderburgh,
and Warrick in the southwest (source: the State of Indiana's
[time zone information page](https://faqs.in.gov/hc/en-us/articles/115005225448-Indiana-Time-Zone-Information),
checked November 3, 2026). `timeZoneForCounty()` picks the right zone from the county name, and a
second sample profile, `evansville` (Vanderburgh County, Central time, with SWIRCA & More as its Area
Agency on Aging), shows a Central-time community. It's data only, not the default.

**Daylight-saving days are handled on purpose.** On March 8, 2026, clocks jump from 1:59 AM to 3:00
AM, so a call typed in for 2:30 AM is rejected with an error, just like February 31. On November 1,
2026, 1:00-1:59 AM happens twice, and PorchLight always uses the first one (still daylight time). The
tests check both zones on both days.

**To launch in another town** (these steps are also at the top of `src/community.js`):

1. Copy the `evansville` profile and give it a new key and id (lowercase, no spaces), for example
   `kokomo`.
2. Fill in `town`, `county` (for example 'Howard County'), and `state`.
3. Set `timeZone` to `timeZoneForCounty('<Name> County')`. That gives Central time for the 12
   Central-time counties and Eastern time everywhere else.
4. Fill in `help` with the county's Area Agency on Aging. Find it on the
   [FSSA list of Area Agencies on Aging](https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/),
   then copy its name, website, and phone numbers from that official page or the agency's own site.
   Give every entry a `source` URL and a `checked` date. If you can't verify a phone number, leave it
   out. Indiana 211, the statewide list, and the 911 line are added for every community
   automatically.
5. Optional: add a few `localTouches` for the offline sparks. Leave it empty to use statewide Indiana
   touches instead.
6. Point the app at it: `export const COMMUNITY = COMMUNITIES.<key>;`
7. Replace the fictional demo people in `src/seed.js` (they're set in Carmel), then run `npm test`.

## Tech stack, and why

| Layer | Choice |
|---|---|
| Server | A ~150-line router on Web-standard Request/Response (`src/http.js`), run by Node's built-in `http` module locally (`src/node-server.js`) or by Cloudflare Workers (`src/worker.js`) |
| Pages | Server-rendered HTML (`src/views/`) with plain CSS and a tiny optional script |
| Data | One JSON document: `data/db.json` locally (written atomically), Durable Object storage on Cloudflare |
| Time | One clock module (`src/tz.js`, with `createClock(timeZone)`) that uses the community's time zone, so times are right on any server |
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
- **Add-on modules instead of one big file.** The Needs attention list, My week, the family
  summary, and calendar files live in `src/features/`; Get help in Indiana lives in `src/indiana/`;
  the tour lives in `src/views/pages/extra.js`. Each registers its own routes, so they were built in
  parallel without editing the same files.

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
  Palladium, the Carmel Farmers Market, the Christkindlmarkt, and others). A town without local
  touches gets statewide Indiana ones, and a test checks that a non-Carmel town never gets Carmel
  text.

| | MOCK_MODE (default) | LIVE_MODE |
|---|---|---|
| Needs internet or a key? | No | Yes: `ANTHROPIC_API_KEY` |
| How it works | Hand-written template bank (`src/sparks/templates.js`), picked by a seeded random generator | Claude writes the sparks (`src/sparks/live.js`) |
| Repeatable? | Yes. The same inputs always give the same sparks; **Show different sparks** moves to the next variant | No. Each request is fresh |
| If something fails | n/a | Automatically falls back to MOCK sparks and says so on the page |

Every set of sparks is labeled as suggestions, with its source ("Written by Claude" or the built-in
offline ideas). My week shows each senior's latest saved sparks and never calls the AI when the page
loads.

**How MOCK mode stays deterministic and still varies:** the senior's ID, interests, last-contact
date, season, and a variant number are hashed (FNV-1a) into a seed for a small pseudo-random
generator (mulberry32). That generator picks the templates. Different seniors and different gaps
since the last call give different sparks, and the same situation always gives the same ones. That
makes the demo repeatable and the feature testable.

**Why AI is used only here:** matching, risk flags, the Needs attention list, and help resources are
plain rules and fixed data, on purpose. A coordinator can explain every match, a family can see
exactly why a flag went up, and each rule has an exact test.

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
- The prompt names the community's town and tells Claude to mention a local place or event only if
  it's sure the place is real.
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

Each senior's card has a chart of completed check-ins per week for 8 weeks, with a "Show weekly
numbers as a table" view of the same numbers for screen readers and anyone who prefers text. Weeks
start and end on local midnights, even across daylight-saving changes.

## Accessibility

Seniors are the primary users, so accessibility was a requirement from the start:

- Large base text, with a **text-size control** (A / A+ / A++) that works without JavaScript
- Text contrast meets **WCAG AAA (7:1)**; status is always shown with an icon **and** words, never
  color alone. Feedback banners pair an icon, a word, and a color
- Full keyboard support, a "Skip to main content" link, and a thick, high-visibility focus ring
- Every page has one clear heading, and every sub-page has a "Back to ..." link
- Every input has a visible label. Checkbox groups use `fieldset`/`legend`. Form errors appear in a
  summary at the top that receives focus and links to each field
- Click targets are at least 44px. At 375px wide with A++ text, nothing scrolls sideways except data
  tables, which sit in a labeled scroll area
- Charts have a text summary and a data table
- Respects "reduced motion," the system "increase contrast" setting, and Windows High Contrast mode
- A print stylesheet hides navigation and buttons and prints key link addresses
- Lighthouse accessibility score: **100** (see [Results](#results-at-the-time-of-writing))

## Testing

```bash
npm test                          # the full suite
TZ=UTC npm test                   # same results on a UTC server (like Cloudflare)
TZ=America/Los_Angeles npm test   # same results in any other time zone
```

At the time of writing there are 102 tests. They cover:
- matching rules and ranking (`test/matching.test.js`);
- risk thresholds, trend detection, and weekly chart buckets (`test/risk.test.js`);
- MOCK sparks (always 3, deterministic, varied, gap-aware) and localized sparks: Carmel touches come
  from the profile, and a non-Carmel profile never produces Carmel text (`test/sparks.test.js`,
  `test/indiana/sparks.test.js`);
- LIVE mode against a local fake Claude server: the request format, privacy (no caregiver details or
  notes are sent), and fallback on a bad key, a refusal, bad output, or no network
  (`test/live.test.js`);
- both Indiana time zones: 4:00 PM in Carmel is 21:00 UTC in January and 20:00 UTC in July; 2:30 AM
  on March 8 is rejected; 1:30 AM on November 1 picks the first occurrence; midnight boundaries;
  impossible dates (`test/indiana/tz.test.js`, `test/indiana/seed-dst.test.js`);
- the 12 Central-time counties, the help entries' sources and dates, and the `/help` page
  (`test/indiana/help.test.js`);
- the Needs attention list, the re-match flow, My week, the family summary, and calendar files
  (`test/features/`);
- the design rules: one h1 per page, the tour, the navigation, back links, banners, and the
  stylesheet (`test/design/design.test.js`);
- a full end-to-end run of the app, plus validation, XSS escaping, settings, missed-call reasons, and
  reset (`test/app.test.js`);
- a link crawler that starts from fresh demo data and follows every internal link on every page,
  checking that none is broken (`test/integration/links.test.js`).

The LIVE tests are skipped automatically if `npm install` hasn't been run.

## Project structure

```
server.js              Local entry point (npm start)
wrangler.jsonc         Cloudflare Workers settings (npm run deploy)
src/
  app.js               Core routes and form validation; registers the add-on modules below
  community.js         Community profiles: town, county, time zone, local touches, local help
  features/            Needs attention, re-match, My week, family summary, calendar files
  indiana/             Get help in Indiana
  http.js              Tiny web framework on Web-standard Request/Response
  node-server.js       Runs the app on Node's http module and serves /public
  worker.js            Runs the app on Cloudflare Workers + a Durable Object
  store-core.js        Data storage, independent of where the data lives
  store.js             JSON file storage for local runs
  app-config.js        Settings shared by Node and Cloudflare (AI mode, threshold)
  config.js            Local settings (.env file, port, data file)
  tz.js                Clock for the community's time zone (createClock for either Indiana zone)
  seed.js              Fictional demo data, dated relative to today
  vocab.js             Shared interest list, time slots, contact methods, missed-call reasons
  matching.js          Matching rules
  risk.js              Isolation-risk rules and weekly counts
  sparks/              Conversation Spark: index (mode switch), mock, templates, live (Claude)
  views/               HTML pages, layout, components, SVG chart; pages/extra.js is the demo tour
public/                CSS (including print styles), small optional script, icon
test/                  Automated tests (features/, indiana/, design/, integration/, and core tests)
docs/                  Competition write-ups, research, diagrams, screenshots
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

- **Not in use yet.** No real volunteer program, senior, or family has used PorchLight. It has no
  partners or pilots.
- **No login or roles.** Everyone can see every screen. A real deployment needs separate accounts for
  seniors, volunteers, families, and coordinators, with each person seeing only what they should.
- **One shared data document.** Locally it's a JSON file; on Cloudflare it's one Durable Object. Both
  are simple and consistent, but a large program would move to real database tables (Cloudflare D1
  or Postgres).
- **No volunteer screening.** A real program needs background checks and training before volunteers
  contact seniors.
- **Notifications are on-screen only.** Families have to open the dashboard to see a flag.
- **Light theme only.** PorchLight follows the system "increase contrast" and Windows High Contrast
  settings, but it has no in-app high-contrast switch or dark mode yet.

## Future work

- **Separate sign-ins** for seniors, volunteers, families, and coordinators, each with their own
  simple view, plus a real database, so the Cloudflare deployment can hold real (not demo) data
- **An Accessibility menu** that brings together text size, a high-contrast switch, and a dark mode
- **SMS and email reminders** for upcoming calls, and **alerts to families** when a flag goes up
- **Partnerships with real volunteer organizations** (school service clubs, senior centers, Area
  Agencies on Aging, faith communities) to recruit, screen, and train companions
- **One statewide PorchLight with a filter by town.** Today each deployment serves one community
  profile. Next, a single deployment could hold every Indiana town's profile, with each senior and
  volunteer tied to a town and a town filter on the dashboard, Needs attention, and Match pages
  (including towns on Central time)
- **Multi-language support,** starting with Spanish, for both the interface and the conversation
  sparks
- **Phone-only access** for seniors without internet (an automated "press 1 to request a call" line)
- Smarter matching that learns from which pairs keep talking, with a human always making the final
  call

## About the data

Every person in the demo data is **fictional**. Names, ages, histories, and families are made up for
the demo.

## Credits

[TEAM: team member names and roles. See `docs/part2_narrative.md`.]

