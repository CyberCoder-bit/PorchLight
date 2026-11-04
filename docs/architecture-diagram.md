# PorchLight architecture

PorchLight is one small server that renders HTML pages, stores data in one JSON document, and (optionally) calls the Claude API. The same code runs in two places: on a laptop with Node.js (`npm start`, data in `data/db.json`), or on the internet with Cloudflare Workers (`npm run deploy`, data in a Durable Object). These diagrams render automatically on GitHub. You can also paste them into [mermaid.live](https://mermaid.live).

## 1. Components and data flow

```mermaid
flowchart TB
  subgraph People["People, using a web browser"]
    direction LR
    SEN["Senior<br/>profile and next call"]
    VOL["Volunteer<br/>calls, logs, sparks"]
    FAM["Family or caregiver<br/>dashboard"]
    COO["Coordinator<br/>matching"]
  end

  subgraph Server["PorchLight server: Node.js locally, or a Cloudflare Worker + Durable Object"]
    ROUTER["Router and form validation<br/>src/http.js, src/app.js"]
    subgraph Engines["Logic: plain functions, covered by tests"]
      direction LR
      MATCH["Matching engine<br/>src/matching.js"]
      RISK["Isolation-risk engine<br/>src/risk.js"]
      SPARK["Conversation Spark<br/>src/sparks/<br/>MOCK templates or LIVE client"]
    end
    VIEWS["HTML pages and SVG chart<br/>src/views/"]
    STORE["Data store<br/>src/store-core.js"]
    COMM["Community profile<br/>src/community.js<br/>town, time zone, local touches, local help"]
    TZ["Clock<br/>src/tz.js<br/>every date in the community's time zone"]
  end

  DB[("data/db.json locally, or Durable Object storage on Cloudflare<br/>seniors, volunteers, matches,<br/>calls and visits, sparks, settings")]
  CLAUDE["Claude API, optional<br/>claude-sonnet-5-5"]

  People -->|"HTTP: page views and form posts"| ROUTER
  ROUTER --> Engines
  Engines --> VIEWS
  VIEWS -->|"finished HTML page"| People
  ROUTER <-->|"read and save"| STORE
  STORE <-->|"atomic write"| DB
  SPARK <-->|"LIVE_MODE only: first name, interests,<br/>days since contact; 3 starters back as JSON"| CLAUDE
  COMM --> TZ
  TZ --> ROUTER
  TZ --> Engines
  %% VERIFY AFTER MERGE: sparks read local touches from the community profile
  COMM -->|"local touches"| SPARK
```

**How to read it:** every click in the browser becomes an HTTP request to the router. Everything
that changes from one Indiana town to another (its time zone, local touches for sparks, and local
help) comes from the community profile, and every date goes through the clock module, so times are
right even on a server that runs on UTC. The router asks the right engine for an answer (who matches, who is at risk, what to say on the next call), saves changes through the store, and sends back a finished HTML page. The only data that ever leaves the server is the optional, privacy-limited call to Claude.

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
  SENIOR ||--o{ MATCH : "is paired in"
  VOLUNTEER ||--o{ MATCH : "is paired in"
  SENIOR ||--o{ CONTACT : "receives"
  VOLUNTEER ||--o{ CONTACT : "makes"
  SENIOR ||--o{ SPARK_SET : "gets"

  SENIOR {
    string id
    string name
    string preferredName
    list interests
    list availability
    string contactMethod
    string aboutMe
    object caregiver
  }
  VOLUNTEER {
    string id
    string name
    list interests
    list availability
    list contactMethods
    int maxSeniors
  }
  MATCH {
    string seniorId
    string volunteerId
    int score
    bool active
    datetime createdAt
  }
  CONTACT {
    string type
    string status
    datetime scheduledFor
    datetime completedAt
    datetime createdAt
    string notes
  }
  SPARK_SET {
    string mode
    list sparks
    datetime createdAt
  }
```

A `CONTACT` has a status of `scheduled`, `completed`, or `missed`. Only `completed` contacts count toward the dashboard.
