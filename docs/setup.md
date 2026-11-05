# Running and deploying PorchLight

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer (tested on Node 24). Nothing else: no
`npm install`, database, account, or API key.

```bash
git clone https://github.com/CyberCoder-bit/PorchLight.git
cd PorchLight
npm start
```

Open **http://localhost:3000**. Port 3000 busy? Run `PORT=3001 npm start` (Windows PowerShell:
`$env:PORT=3001; npm start`).

On first run, PorchLight creates `data/db.json` with the fictional demo data. To keep the data
somewhere else, set `DATA_FILE`, for example `DATA_FILE=/tmp/pl/db.json npm start`.

## Demo accounts

Every demo account uses one shared demo password, `PorchLight-demo-2026` (the code stores only a
PBKDF2 hash).
On `/sign-in`, the buttons under **Try a demo account** sign in with one click. The coordinator
has no button.

| Email | Who |
|---|---|
| `admin@porchlight.example` | Casey Reed, the coordinator (everything under `/admin`) |
| `hal@porchlight.example` | Hal, a senior |
| `samira@porchlight.example` | Samira, a senior who reads Arabic |
| `ethan@porchlight.example` | Ethan, a volunteer |
| `jordan@porchlight.example` | Jordan, a volunteer who uses translate help |
| `mike@porchlight.example` | Mike, Hal's son |
| `noah@porchlight.example` | Noah, a volunteer waiting for approval |
| `ellen@porchlight.example` | Ellen, Walter's daughter, whose family link is waiting |

Everyone else is `firstname@porchlight.example` (seniors dorothy, rosa, eugene, thanh, cing, aung,
mei, marguerite, helga, walter; volunteers maya, linda, sam, kevin, david, amy, olivia; family karen,
daniel, grace, omar, linh, ryan, sophie, peter).

As the coordinator, **Reset demo data** (`/admin/demo/reset`) restores the demo story with dates
moved to today, and deletes new sign-ups and sessions. Please don't use real details when you sign
up.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Run the app at http://localhost:3000 |
| `npm test` | Run the automated tests |
| `npm run reset` | Reset the demo data |
| `npm install` | Optional: only for LIVE mode (the Anthropic SDK) or Cloudflare (wrangler) |
| `npm run dev` | Run the Cloudflare Workers version at http://localhost:8787 |
| `npm run deploy` | Deploy to Cloudflare Workers |

## Deploy to Cloudflare Workers

The same app runs on Cloudflare Workers (free plan). Pages are served by `src/worker.js`, and the
data lives in a Durable Object instead of `data/db.json`.

```bash
npm install            # one time
npx wrangler login     # one time
npm run deploy         # prints your URL, like https://porchlight.<your-subdomain>.workers.dev
```

- For LIVE mode, run `npx wrangler secret put ANTHROPIC_API_KEY`, then deploy again.
- Run `npm install` and `wrangler` on the same system you deploy from (a `node_modules` folder
  from WSL won't work in Windows PowerShell, and the other way around).
- Times stay in Indiana time even though Cloudflare runs on UTC: every date goes through
  `src/tz.js`.
- The demo password is public, so don't put real people's information in a public deployment.
  Remove the demo accounts and buttons before a real launch.

## LIVE mode (optional)

Without a key, PorchLight uses built-in conversation starters and ready-made translations. With a
Claude API key, Claude writes the starters and translates messages.

```bash
npm install
cp .env.example .env        # then paste your key into .env
npm start
```

Or run `ANTHROPIC_API_KEY=sk-ant-... npm start`. The header badge changes to **AI: Live (Claude)**,
and `/about-ai` shows the active mode.

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | Your Claude API key |
| `SPARK_MODE` | `auto` | `auto`: LIVE if a key is set and the SDK is installed. `mock`: always offline. `live`: ask for LIVE and warn if it can't run |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Which Claude model to use |
| `RISK_THRESHOLD_DAYS` | `7` | Starting value for the dashboard alert setting |
| `TRANSLATE_DAILY_PER_ACCOUNT` | `30` | LIVE translations per account per day |
| `TRANSLATE_DAILY_TOTAL` | `300` | LIVE translations for the whole site per day |
| `DATA_FILE` | `data/db.json` | Local data file (Node only) |
| `PORT` | `3000` | Web server port |

If a LIVE request fails, PorchLight falls back to the offline mode and says why.

## Tests

```bash
npm test                          # the full suite
TZ=UTC npm test                   # same results on a UTC server (like Cloudflare)
TZ=America/Chicago npm test       # same results on a Central-time computer
```

All 318 tests pass. Without `npm install`, the LIVE-mode tests are skipped; with it, they run
against a local fake API server. The tests cover matching, the risk flag, sparks, accounts and
access for every role, every language file, translation, both Indiana time zones and
daylight-saving days, towns, accessibility colors, the public site, a full end-to-end run, and a
crawler that follows every internal link.

## Launch in another Indiana town

People in another town in the same time zone need no code: give them that town. For a new
community profile (for example, the Central-time deployment), follow the steps at the top of
`src/community.js`:

1. Copy the `evansville` profile and give it a new key and id, for example `kokomo`.
2. Fill in `town`, `county`, and `state`, and set `timeZone` to `timeZoneForCounty('<Name> County')`.
3. Fill in `help` with the county's Area Agency on Aging from the
   [FSSA list](https://www.in.gov/fssa/ddars/bba/area-agencies-on-aging/), with a `source` URL and a
   `checked` date for every entry.
4. Optional: add a few `localTouches` for the offline sparks.
5. Point the app at it (`export const COMMUNITY = COMMUNITIES.<key>;`), replace the demo people in
   `src/seed.js`, and run `npm test`.

## Project structure

```
server.js            Local entry point (npm start)
wrangler.jsonc       Cloudflare Workers settings
src/
  app.js             Core routes and form validation
  http.js            Small router on Web-standard Request/Response
  node-server.js     Runs the app on Node; worker.js runs it on Cloudflare
  store-core.js      Data storage; store.js is the JSON file for local runs
  auth/              Passwords, sessions, rate limits, sign-in, sign-up, approvals
  roles/             The server-side access table
  matching.js        Matching rules
  risk.js            Isolation-risk rules and the one "needs attention" rule
  sparks/            Conversation starters: offline templates and LIVE mode
  translate/         Messages, translation service, phrase card, conversation helper
  i18n/              Interface languages, one file per language
  features/          Needs attention, My week, family summary, calendar files
  indiana/           Get help in Indiana
  towns/             Indiana towns and counties
  community.js       Community profiles: town, county, time zone, local help
  tz.js              Clock for the deployment's time zone
  seed.js            Fictional demo data
  views/             HTML pages, layout, components, chart; site/ is the public website
public/              CSS, fonts, logo files, a small optional script
test/                Automated tests
docs/                Design details, research, brand, diagrams, screenshots
```
