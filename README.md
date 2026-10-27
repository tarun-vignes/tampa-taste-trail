# Tampa Taste Trail

**Your kind of taste. A different kind of Tampa.**

A taste-aware outing planner for Tampa visitors and residents who want a small, considered plan rather than another generic list. Music, film, dining and activity interests become editable cultural signals; Qloo discovers nearby places using those signals; the app validates geography and suggests an order.

**Current status:** local implementation; no GitHub repository, hosted site, or Devpost submission has been created. A real Gemini request was tested. No Qloo credential was available, so real Qloo discovery still needs verification. Fictional previews are explicitly separate and do not qualify as the event's real Qloo-powered demo.

## Run locally

Requires **Node.js 22.19+** and npm. From this folder in PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Open **http://127.0.0.1:3003**. `npm.cmd` avoids PowerShell script-policy restrictions; macOS/Linux users can use `npm` and `cp .env.example .env`.

The app opens without credentials. It explains what is missing, allows editable rule-based preference extraction, and offers a separate **Explore fictional preview** button when preview mode is enabled. It never silently converts a Qloo failure into a mocked itinerary. First use may require Next.js to compile its routes.

For a production-mode local check:

```powershell
npm.cmd run build
npm.cmd start
```

Both commands serve at port 3003 for this dedicated project, avoiding the other hackathon apps. Stop the owned server with Ctrl+C. Do not overwrite an existing `.env` when re-running setup.

## Example journey

1. Enter: “I like Afrobeats, sci-fi movies, and spicy food. Plan a relaxed Saturday evening in Tampa for two people, under $100.”
2. Inspect the parser's taste terms, category, lookup type, date, budget and group size. Correct, remove or add terms before discovery. Diet/accessibility preferences may appear as unverified notes; they are not assurances.
3. Click **Find my Qloo signals**. Named artists/films use Qloo entity Search; genres and concepts use Qloo Tags. Review the returned candidates. Only an exact, unique name match is preselected; ambiguous candidates need your explicit choice.
4. Click **Build my taste trail**. The server revalidates the selected IDs against lookup results and sends them as Qloo Insights interest signals with a Tampa area filter.
5. Inspect up to two relaxed or three balanced stops, returned category tags and descriptions, source labels, unknowns, and the agent trace. If results are insufficient, the app says so rather than inventing another venue or event.
6. Replace one stop using an alternative from the same validated candidate pool. Change budget, neighborhood or focus in the existing profile without re-entering your original request. Budget alone remains context; it does not become a fabricated price constraint.

## Why Qloo changes the result

Live stop names and IDs come exclusively from **Qloo Insights**, not the model or a bundled Tampa venue list. Confirmed artist/movie IDs enter `signal.interests.entities`; confirmed genre/concept tags enter `signal.interests.tags`. Changing the taste signals changes the actual discovery query. Qloo supplies the taste-ranked candidates; the app chooses a small sequence using returned tags and coordinates.

The AI does not generate venue facts or an itinerary and cannot invent IDs. Without Qloo, **there is no live cultural trail**. The original fictional fixtures are an explicit UI testing path only. No claim of measured recommendation quality or improvement over an LLM baseline is made without real-user/API evaluation.

Every stop states the exact input signals used for its query. This is query provenance, **not** a claimed pairwise causal explanation or a guaranteed personal match. The app does not display invented similarity, popularity or affinity scores.

## Credentials

### Qloo — required for real discovery

Start with the [official hackathon developer guide/key request](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key), linked from the current event. Follow the organizer's access instructions and keep the issued credential private.

```dotenv
QLOO_API_KEY=your_private_qloo_key
QLOO_BASE_URL=https://api.qloo.com
```

The default production origin is documented by Qloo's official mirror and published harness. **Your event-issued key may require a different Qloo API origin. Use the exact host stated by its issuer**; a key configured for another host may fail. The code accepts HTTPS Qloo API origins, never probes alternate hosts after an error, and rejects non-Qloo credential destinations. A particular event hostname is not asserted as live-tested here.

The key is sent only in the server's `X-Api-Key` header. It is never placed in a URL, public environment variable, browser storage, log, or response. See [API contract/evidence](docs/api-contract.md) for the exact implemented fields and verification limits.

### Gemini — optional generative extraction

An existing environment `GEMINI_API_KEY` was available and tested without copying it into this project. For another machine or host, add a key from [Google AI Studio](https://aistudio.google.com/apikey):

```dotenv
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.1-flash-lite
AI_PROVIDER=gemini
```

Gemini `generateContent` receives only the request and a JSON Schema. Server validation rejects malformed profiles. Only an explicit dollar-sign/tier request can set the restaurant price-level field; a numerical dollar budget cannot become a tier just because the model inferred one. The user reviews extraction before any Qloo search.

With no key, or `AI_PROVIDER=rules`, the UI says **rule-based extraction**. If a configured model fails, the user sees the error and must explicitly choose the rule-based option. Rules can still use real Qloo discovery when the Qloo key exists. No profile or account is saved.

### Fictional preview

```dotenv
ALLOW_FIXTURE_DEMO=true
```

Local development enables fixtures by default. Production disables them unless this variable is explicitly `true`. The sample places, IDs and coordinates are fictional originals in `lib/server/fixtures.ts`; they are not real businesses or exported Qloo data. A fixture preview is always labeled and has no directions/website actions. It must not be presented as a real Qloo integration or the submission's required functional cultural-discovery demo.

`APP_ORIGIN` is optional. Set it to the exact HTTPS origin (without a trailing slash) when using a custom/proxied host; otherwise same-origin API checks use the request URL. `RENDER_EXTERNAL_URL` is supported if deploying to Render.

## What is and is not verified

| Information                                                              | Source and limit                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Taste interpretation                                                     | Gemini or labeled rules; editable and potentially wrong                                                             |
| Resolved IDs and candidate names                                         | Qloo Search/Tags, or separately explicit fictional fixtures                                                         |
| Place names/descriptions/tags/coordinates                                | Validated Qloo response fields; absent descriptions stay absent                                                     |
| Geographic fit                                                           | App checks returned coordinates against its approximate area circle and broad Tampa bounds                          |
| Dining/activity role                                                     | App inference from returned tag IDs/names; otherwise called a generic place                                         |
| Outing order                                                             | App inference from categories and straight-line proximity among taste-ranked candidates                             |
| Total budget                                                             | User's group target; **price not verified**, no computed outing cost                                                |
| Optional restaurant tier                                                 | Requested 1–4 Qloo tier; not converted into dollars, not a menu quote                                               |
| Date, opening hours, reservations, capacity, accessibility, diet, events | **Not verified**; user must check before going                                                                      |
| Map                                                                      | Decorative schematic with relative coordinates, not actual streets, route navigation, distance scale or travel time |

No secondary venue dataset, scraper, map-tile provider, live events API, booking engine, current menu/ticket feed, or hidden fallback catalog is used. The app-selected search centers are approximations, not official neighborhood boundaries. Unknown/malformed coordinates are dropped, not guessed. A returned but ignored filter cannot silently cause an out-of-area recommendation because coordinates are checked again locally.

## Architecture

Next.js App Router, React, TypeScript, server-side route handlers, Zod validation and plain CSS. No database, login, payments, profiles, queue, or agent framework is needed.

```text
app/                     Page, layout, styles, API routes and health check
components/              Intake/profile, signal review, itinerary, original SVGs
lib/server/ai.ts          Gemini boundary + explicit rule extraction
lib/server/qloo.ts        Qloo auth, bounded transport, parsing and geography checks
lib/server/agent.ts       Resolve → validate → discover → assemble orchestrator
lib/server/fixtures.ts    Explicit original fictional UI fixtures
lib/trail.ts             Stop-role labels and validated-pool replacement
tests/                   Parser, provider, agent, HTTP and UI tests
scripts/                 Opt-in live checks, browser check and bounded secret scan
docs/                    Contract, architecture, demo and submission drafts
```

Full request flow and trust boundaries: [architecture](docs/architecture.md).

## Verification commands

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run check:secrets
```

All automated tests mock external providers and run without API keys. Live checks are explicit and can consume quota:

```powershell
npm.cmd run check:ai
npm.cmd run check:qloo
```

`check:qloo` requires an issued key and correct host. It fails visibly when credentials, exact lookup matches or verified stops are unavailable; it never marks a fixture result as success. Public live verification on October 27 resolved Burna Boy, Interstellar and spicy food, revalidated all three IDs, and built a real two-stop trail. See [verification](docs/verification.md) for the exact test scope; no provider key is bundled.

With the local app running and fictional preview enabled:

```powershell
npm.cmd run check:browser
```

This uses installed Chrome/Edge/Chromium through Playwright Core. Set `BROWSER_EXECUTABLE` if auto-detection cannot find yours, and `TEST_ORIGIN` if using another local URL. The script explicitly forces rule extraction and fixture discovery, so it spends no model or Qloo quota. It captures actual preview screenshots in ignored `artifacts/screenshots/`. Test results and limits are recorded in [verification](docs/verification.md).

## Security and limits

Inputs and model/provider responses are untrusted. The server validates body size (16 KB), prompt length, taste count (four), dates/times, group size, selected IDs and response envelopes. Mutations require a custom intent header and matching browser origin when supplied. Requests have timeouts; no blind retry loop exists. IDs selected by the browser must reappear in server-side lookup results for the same profile before Insights can run. Text uses React escaping, and external website links must be HTTPS.

Up to four lookup terms, two concurrent lookups, one nearby Insights query per build. Lookup responses may be reused for revalidation from a bounded 64-entry, five-minute, in-memory cache. In a cold serverless function, they may need another lookup round. The app limits incoming planning requests to 18/minute per hashed client IP per instance and actual outbound Qloo requests to 30/minute per client instance. **These are application safeguards, not verified Qloo account quotas.** Obtain the event's actual quota/rate/expiry from the issuer. Provider 401/403/429 failures remain visible. Runtime memory limits/caches reset on restart and are not distributed abuse protection.

No secrets belong in `NEXT_PUBLIC_*`, Git, screenshots, recordings or shared text. `.env*` is ignored except the blank example. Qloo data remains subject to the API access terms; the MIT code license does not grant rights to redistribute provider data. No live API result snapshots are bundled. Original illustrations and fictional fixtures use MIT. Dependencies retain their own licenses.

## Source publication and hosting

The source is published at [tarun-vignes/tampa-taste-trail](https://github.com/tarun-vignes/tampa-taste-trail). The public app is [tampa-taste-trail.onrender.com](https://tampa-taste-trail.onrender.com), verified with real Qloo discovery on October 27. The [Render deployment steps](docs/render-deployment.md) describe reproducing the free-service deployment in your own account.

The commands below document initial publication from **this folder**, not the workspace root. This checkout is already connected and pushed; do not repeat repository creation:

```powershell
git init -b main
git add .
git commit -m "Build Tampa Taste Trail"
gh auth login
gh repo create tarun-vignes/tampa-taste-trail --public --source=. --remote=origin --push
```

If that repository already exists, inspect its history and preserve it before connecting/pushing; never force-push as a shortcut. The root MIT license should be detected on GitHub.

For **Vercel**: import the public repository, choose Next.js, leave the root at the repository root, use Node 22, and set private runtime `QLOO_API_KEY`, the issuer-authorized `QLOO_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL` and `AI_PROVIDER`. Keep `ALLOW_FIXTURE_DEMO=false` for a live-only judge experience. Deploy only after you authorize it, then use the actual assigned URL and verify it anonymously. The checked-in route limits allow up to 60 seconds per planning request. Hosted keys must be configured separately; local environment variables do not automatically transfer to Vercel.

After deployment, personally exercise real taste resolution, signal review, geography, empty/failure states and itinerary replacement. Keep the live app usable for judges. No hosted URL is fabricated here.

## Devpost readiness

The [official event](https://qloo.devpost.com/) lists **October 30, 2026, 11:45 p.m. EDT**. It requires a real functional demo published externally, public source, an open-source license, and a description. **No video is required.** Confirm your eligibility and current rules; a local or fixture-only preview does not complete those submission requirements.

Source publication, external deployment and a public three-signal Qloo flow have been verified. Remaining: confirm current eligibility/access rules, review recommendation quality for your chosen tastes, complete your personal description, and submit manually. Prepared materials: [event check](docs/event-verification.md), [live walkthrough](docs/demo-script.md), [editable submission](docs/submission-draft.md). No personal inspiration, user research, impact result or learning outcome is invented.
