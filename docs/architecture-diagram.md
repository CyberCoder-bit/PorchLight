# PorchLight architecture

PorchLight is one small server that renders HTML pages, stores data in one JSON document, and (optionally) calls the Claude API. The same code runs in two places: on a laptop with Node.js (`npm start`, data in `data/db.json`), or on the internet with Cloudflare Workers (`npm run deploy`, data in a Durable Object). These diagrams render automatically on GitHub. You can also paste them into [mermaid.live](https://mermaid.live).

## 1. Components and data flow

```mermaid
flowchart TB
  subgraph People["People, using a web browser"]
    direction LR
    VIS["Signed-out visitor<br/>public website only"]
    SEN["Senior<br/>own page, messages, family code"]
    VOL["Volunteer<br/>My week, logs calls, sparks, messages"]
    FAM["Family member<br/>own senior's card, weekly summary"]
    COO["Coordinator at /admin<br/>matching, Needs attention, approvals"]
  end

  subgraph Server["PorchLight server: Node.js locally, or a Cloudflare Worker + Durable Object"]
    AUTH["Accounts and sessions<br/>src/auth/<br/>PBKDF2 passwords, HttpOnly cookie, rate limits"]
    GUARD["Access table<br/>src/roles/access.js<br/>checked before every request"]
    I18N["Interface languages<br/>src/i18n/<br/>t(), 8 languages, picker, spoken languages"]
    SITE["Public website<br/>src/views/site/"]
    TRANS["Messages and translation<br/>src/translate/<br/>MOCK ready-made or LIVE Claude, cache, daily limits"]
    ROUTER["Router and form validation<br/>src/http.js, src/app.js"]
    subgraph Engines["Logic: plain functions, covered by tests"]
      direction LR
      MATCH["Matching engine<br/>src/matching.js<br/>interests, time, language"]
      RISK["Isolation-risk engine<br/>src/risk.js"]
      SPARK["Conversation Spark<br/>src/sparks/<br/>MOCK templates or LIVE client"]
    end
    VIEWS["HTML pages and SVG chart<br/>src/views/"]
    STORE["Data store<br/>src/store-core.js"]
    COMM["Community profile<br/>src/community.js<br/>town, time zone, local touches, local help"]
    TZ["Clock<br/>src/tz.js<br/>every date in the deployment's time zone"]
    TOWNS["Towns and counties<br/>src/towns/<br/>town filter, same-county visits"]
    PREFS["Accessibility choices<br/>text size, contrast, theme<br/>cookies read by src/views/layout.js"]
    ADDON["Add-on pages, each registering its own routes<br/>src/features/: Needs attention, re-match, My week,<br/>family summary, calendar file<br/>src/indiana/: Get help in Indiana<br/>src/views/pages/extra.js: demo tour"]
  end

  DB[("data/db.json locally, or Durable Object storage on Cloudflare<br/>users, sessions, family links, seniors, volunteers,<br/>matches, calls and visits, sparks, messages,<br/>translation cache, daily usage, settings")]
  CLAUDE["Claude API, optional<br/>claude-sonnet-5-5"]

  People -->|"HTTP: page views and form posts"| AUTH
  AUTH -->|"who is asking"| GUARD
  GUARD -->|"allowed"| ROUTER
  GUARD -->|"signed out"| SITE
  I18N --> VIEWS
  I18N --> SITE
  ROUTER --> TRANS
  TRANS <-->|"LIVE only: the text a person chose to translate<br/>and two language names"| CLAUDE
  PREFS --> VIEWS
  ROUTER --> Engines
  Engines --> VIEWS
  VIEWS -->|"finished HTML page"| People
  ROUTER <-->|"read and save"| STORE
  STORE <-->|"atomic write"| DB
  SPARK <-->|"LIVE_MODE only: first name, interests,<br/>days since contact; 3 starters back as JSON,<br/>also in the senior's language"| CLAUDE
  COMM --> TZ
  TZ --> ROUTER
  TZ --> Engines
  COMM -->|"local touches"| SPARK
  ROUTER --> ADDON
  ADDON --> Engines
  COMM -->|"local help"| ADDON
  COMM -->|"time zone"| TOWNS
  TOWNS --> ROUTER
  TOWNS -->|"same county for visits"| MATCH
```

**How to read it:** every click in the browser becomes an HTTP request. The accounts module reads
the session cookie to find out who is asking. Then the access table checks the request on the
server. Signed out, only the public website, the tour, Get help, and the sign-in and sign-up pages
are allowed; anything else sends you to `/sign-in`. Signed in, a person who asks for a page that
isn't theirs gets "This page is not for your account". An admin may open everything. Then the
request goes to the router. The request's language (from the account, then the `lang` cookie, then
the browser, then English) follows it through every page, so `t()` picks the right text. Everything that changes from one Indiana community to another (its time zone, local touches
for sparks, and local help) comes from the community profile, and every date goes through the clock
module, so times are right even on a server that runs on UTC. Each deployment runs one time zone, so
the time-zone design covers all 92 of Indiana's counties with two deployments. The town list isn't
complete yet: it has 66 towns in 52 counties, and adding a town is one line in `src/towns/index.js`.
The Accessibility
choices are cookies that the page layout reads, so every page is drawn in the chosen text size,
contrast, and theme without JavaScript. The router asks the right engine for an answer (who matches, who is at risk, what to say on the next call), saves changes through the store, and sends back a finished HTML page. The only data that ever leaves the server is the optional, privacy-limited calls to Claude: one for
sparks, and one for translating a message that a person chose to translate, after a notice.

## 2. The PorchLight loop

```mermaid
flowchart LR
  A["1. Match<br/>shared interests and free time"] --> B["2. Connect<br/>volunteer schedules and logs calls"]
  B --> C["3. Spark<br/>AI conversation starters before each call"]
  C --> B
  B --> D["4. Watch<br/>dashboard counts check-ins"]
  D -->|"contact dropping or overdue"| E["Flag for family and coordinator"]
  E -->|"reach out or re-match"| A
```

## 3. Conversation Spark: MOCK, LIVE, and fallback

```mermaid
sequenceDiagram
  actor V as Volunteer
  participant App as app.js (router)
  participant Svc as Spark service
  participant Live as live.js
  participant API as Claude API
  participant Mock as mock.js
  participant DB as db.json

  V->>App: POST /seniors/:id/sparks
  App->>Svc: interests, days since last contact, season
  alt LIVE_MODE (API key set and SDK installed)
    Svc->>Live: generateLiveSparks()
    Live->>API: messages.create with JSON schema, effort low
    alt Claude answers
      API-->>Live: 3 starters as JSON
      Live-->>Svc: sparks, model name
    else timeout, bad key, refusal, or bad output
      Live-->>Svc: LiveSparkError with reason
      Svc->>Mock: generateMockSparks()
      Mock-->>Svc: 3 offline sparks and a notice
    end
  else MOCK_MODE (default)
    Svc->>Mock: generateMockSparks(seeded by inputs)
    Mock-->>Svc: 3 offline sparks
  end
  Svc-->>App: sparks, mode, tip
  App->>DB: save spark set with timestamp and mode
  App-->>V: 303 redirect to profile, sparks shown
```

## 4. Isolation-risk flag (per senior)

```mermaid
flowchart TD
  START["Completed calls and visits for one senior"] --> HAS{"Has an active companion?"}
  HAS -- No --> NEED["✚ Needs a companion"]
  HAS -- Yes --> DAYS["Days since last completed contact<br/>or since the match, if no calls yet"]
  DAYS --> OVER{"More than the threshold?<br/>default 7 days"}
  OVER -- Yes --> RISK["⚠ Isolation risk"]
  OVER -- No --> SOON{"Within 2 days of the threshold,<br/>or first call still pending?"}
  SOON -- Yes --> CHECK["◷ Check in soon"]
  SOON -- No --> OK["✓ Connected"]
  START --> TREND{"Last 4 weeks at or below half<br/>of the 4 weeks before?"}
  TREND -- Yes --> DROP["↓ Contact dropping"]
```

## 5. Data model

```mermaid
erDiagram
  USER ||--o| SENIOR : "is (role senior)"
  USER ||--o| VOLUNTEER : "is (role volunteer)"
  USER ||--o{ SESSION : "has"
  USER ||--o{ FAMILY_LINK : "asks to follow (role family)"
  SENIOR ||--o{ FAMILY_LINK : "is followed through"
  SENIOR ||--o{ MATCH : "is paired in"
  VOLUNTEER ||--o{ MATCH : "is paired in"
  MATCH ||--o{ MESSAGE : "has"
  SENIOR ||--o{ CONTACT : "receives"
  VOLUNTEER ||--o{ CONTACT : "makes"
  SENIOR ||--o{ SPARK_SET : "gets"

  USER {
    string id
    string email
    string name
    string role
    string uiLanguage
    object password
    datetime createdAt
  }
  SESSION {
    string tokenHash
    string userId
    datetime expiresAt
  }
  FAMILY_LINK {
    string userId
    string seniorId
    string relationship
    string status
  }
  SENIOR {
    string id
    string name
    string preferredName
    list interests
    list availability
    string contactMethod
    string aboutMe
    object caregiver
    string town
    list languages
    bool translateHelp
    string familyCode
  }
  VOLUNTEER {
    string id
    string name
    string town
    list interests
    list availability
    list contactMethods
    int maxSeniors
    list languages
    bool translateHelp
    string status
  }
  MATCH {
    string seniorId
    string volunteerId
    int score
    bool active
    datetime createdAt
  }
  MESSAGE {
    string matchId
    string fromKind
    string text
    string lang
    datetime createdAt
  }
  CONTACT {
    string type
    string status
    datetime scheduledFor
    datetime completedAt
    datetime createdAt
    string notes
    string missedReason
    string missedNote
    datetime markedAt
  }
  SPARK_SET {
    string mode
    list sparks
    datetime createdAt
  }
```

A user's `role` is `admin`, `senior`, `volunteer`, or `family`. `password` holds the PBKDF2-SHA256
salt, hash, and iteration count; the password itself is never stored. A session stores only the
SHA-256 of its token. A family link is `pending` until a coordinator approves or declines it, and a
volunteer's `status` is `pending` until approved. `languages` is a list of `{ code, level }`, where
the level is native, fluent, conversational, or learning. A message keeps the language it was
written in; translations are cached separately (keyed by a hash of the two languages and the text,
at most about 500), and the daily LIVE translation counts are kept per Indiana day.

A `CONTACT` has a status of `scheduled`, `completed`, `missed`, or `cancelled` (a future call that was cancelled because its match ended; it stays in the history). Only `completed` contacts count toward the dashboard. A missed contact can record an optional reason (no answer, senior was unavailable, volunteer had a conflict, or other) and a short note. Coordinators see these on the Needs attention list; they are never sent to the AI.
