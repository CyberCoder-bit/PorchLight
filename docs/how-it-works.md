# How PorchLight works

## The 2-minute tour

The tour at `/tour` walks through the demo story in 8 steps, each with a button that opens it:

1. **Sign in as the coordinator, then reset the demo data.**
2. **Family Dashboard: Hal is flagged.**
3. **The Needs attention list.**
4. **Match Gene with a companion.**
5. **Ethan's week.**
6. **Conversation sparks on Hal's profile.**
7. **See it as Hal's family.**
8. **Get help in Indiana, and the Accessibility menu.**

## Accounts and who sees what

- **Passwords** are hashed with PBKDF2-SHA256 (40,000 iterations, a random salt per user).
- **Sessions** use a random token in an HttpOnly, SameSite=Lax cookie (Secure on https). Only the
  token's SHA-256 is stored, and a session lasts 8 hours.
- **Rate limits:** at most 5 wrong passwords per email and address in 15 minutes, and 5 new accounts
  per address in an hour.
- **Sign-up** is open to seniors, volunteers, and family members. New volunteers wait for a
  coordinator's approval. A family member enters the senior's family code, and a coordinator
  approves the link.
- **Access** is one table (`src/roles/access.js`), checked on the server before every request. A
  volunteer sees only their own week, seniors (first name, interests, languages, free times), and
  calls. A family member sees only their own senior's card, page, and weekly summary, never call
  notes. Signed out, you see only the public website, the tour, Get help, and `/about-ai`.
- **The coordinator's pages** are under `/admin`, hidden from search engines and not linked from
  the public site.

## Matching (`src/matching.js`)

A volunteer is suggested only if they have room, share at least one weekly time slot, offer the
senior's preferred contact method, live in the same county for in-person visits, are approved, and
share a language with the senior at conversational level or better. The one exception: if both
people turned on translate help, a pair with no shared language is allowed.

| Points | For |
|---|---|
| +3 | each shared interest |
| +2 | each shared time slot (up to 5) |
| +4 | a shared language |
| +1 | a volunteer with no seniors yet |

Ties go to the volunteer with fewer seniors. The match page shows each suggestion's points and why
every other volunteer was left out. A coordinator always makes the final choice.

## The isolation-risk flag (`src/risk.js`)

Only completed calls and visits count.

| Flag | Rule (default threshold: 7 days) |
|---|---|
| ⚠ Isolation risk | No completed contact for more than the threshold |
| ◷ Check in soon | Within 2 days of the threshold, or newly matched and waiting for the first call |
| ✚ Needs a companion | Not matched with a volunteer |
| ✓ Connected | Regular contact is happening |
| ↓ Contact dropping | Check-ins in the last 4 weeks fell to half or less of the 4 weeks before |

A senior **needs attention** if they're at isolation risk, need a companion, have contact
dropping, or had a missed call in the last 14 days. One function decides this for Home, the
dashboard, and Needs attention, so the numbers always agree. A coordinator can change the threshold
(1 to 60 days). Each senior's card has a weekly chart with a table view of the same numbers.

## Conversation sparks (`src/sparks/`)

Talking to someone decades older can feel awkward. A spark is three short starters built from the
senior's interests and "about me" text, how long it's been since the last call, the season, and
local touches from the community profile.

| | Offline (default) | LIVE |
|---|---|---|
| Needs a key? | No | Yes: `ANTHROPIC_API_KEY` |
| How | A hand-written template bank, picked by a seeded random generator | Claude writes them |
| Repeatable? | Yes; **Show different sparks** moves to the next set | No |
| If it fails | n/a | Falls back to offline sparks and says why |

In LIVE mode, sparks for a senior whose main language isn't English also come in that language.
Every set is labeled "Suggestions only" with its source. Only the senior's first name, interests,
"about me" text (with phone numbers and emails removed), days since the last contact, the contact
type, and the date are sent. Family contacts, call notes, and missed-call reasons are never sent. AI is never used for
matching, risk flags, or access.

## Messages and translation (`src/translate/`)

A matched pair can write to each other, and each message shows in the reader's language with
"Show original". There's also a phrase card and a conversation helper.

| | Offline (default) | LIVE |
|---|---|---|
| Translated | The ready-made demo messages and the phrase card | Any message a person writes |
| Sent to the AI | Nothing | Only the text and the two language names |
| Before sending | The form says nothing leaves PorchLight | The form says the text will be sent to Claude |
| Limits | None | 30 per account and 300 in total per day, cached |

Every translated message is labeled as a machine translation that may contain mistakes.

## Languages (`src/i18n/`)

- **Interface:** English, Spanish, Simplified Chinese, Burmese, Haitian Creole, German, Arabic
  (right to left), and Vietnamese, chosen from Census data ([research](research.md), section 4).
  The choice is saved on your account, or comes from a cookie, then your browser, then English.
- All languages besides English are machine-translated and need a native speaker's review.
- **Spoken languages** are a longer list used for matching, including Hakha Chin and Pennsylvania
  Dutch, which have no interface because we can't check a translation.

## Towns and time zones

- `src/towns/index.js` lists 66 towns in 52 of Indiana's 92 counties. Every list can be filtered by
  town. Phone and video calls work statewide; in-person visits need the same county.
- Indiana has two time zones (12 counties use Central time), so each deployment serves one time
  zone and every date goes through one clock (`src/tz.js`).
- Daylight-saving days are handled: a time that doesn't exist is rejected, and a time that happens
  twice uses the first one.

## Accessibility

- An **Accessibility** menu on every page: text size (A, A+, A++), standard or high contrast, and
  light, dark, or device theme. It works without JavaScript.
- Text contrast meets WCAG AAA (7:1) in every theme. Status always uses an icon and words, never
  color alone.
- Full keyboard support, a skip link, a visible focus ring, labeled inputs, error summaries that
  take focus, 44px targets, and no sideways scrolling at 375px with A++ text.
- On phones, the navigation sits behind a **Menu** button.
- Lighthouse accessibility scored 100 on the pages we measured.

## Tech choices

| Layer | Choice |
|---|---|
| Server | A small router on Web-standard Request/Response, run by Node's `http` module or Cloudflare Workers |
| Pages | Server-rendered HTML and plain CSS, with the Atkinson Hyperlegible Next font |
| Data | One JSON document: a file locally, a Durable Object on Cloudflare |
| Chart | Inline SVG drawn on the server |
| AI (optional) | Claude through the official `@anthropic-ai/sdk`, for sparks and translation only |
| Tests | Node's built-in test runner |

- **No required dependencies,** so `npm start` works on a locked-down school network.
- **Server-rendered HTML,** because seniors are the main users: real forms and labels work with
  screen readers, zoom, keyboards, and old browsers, even if JavaScript fails.
- **A JSON file instead of a database,** the simplest reliable option for a prototype. Writes go to
  a temp file and are renamed, so a crash can't corrupt it.
- **Modules that register their own routes,** so features don't edit the same files.

## Limitations

- No real program, senior, or family has used PorchLight yet.
- The demo accounts are open on purpose; a real launch would remove them.
- No email is sent (no password reset or email alerts); notifications are on-screen only.
- Translations are machine-made and haven't been checked by native speakers.
- LIVE translation hasn't been tried with a real API key, only a local fake server.
- One time zone per deployment, and the town list covers 52 of 92 counties so far. A few towns
  (Zionsville, Greenwood, Plainfield, West Lafayette, Mishawaka, Elkhart, Gary, Hammond, Portage,
  Michigan City, Newburgh) haven't been checked against an official page yet.
- No volunteer screening; a real program needs background checks and training.
- "Same county" is a rough stand-in for distance.

## Future work

- Native-speaker review of each language
- Email and SMS: password reset, call reminders, and family alerts
- A real database (Cloudflare D1 or Postgres)
- A phone line for seniors without internet
- Per-senior time zones, so one deployment serves all 92 counties
- Partnerships with volunteer organizations to recruit, screen, and train companions
