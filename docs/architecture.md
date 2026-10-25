# Architecture and trust boundaries

```mermaid
sequenceDiagram
    participant U as User / Next.js UI
    participant A as Server orchestrator
    participant G as Gemini (optional)
    participant Q as Qloo
    U->>A: Plain-language taste request
    A->>G: Request + bounded profile schema
    G-->>A: Structured preferences, not venues or IDs
    A->>A: Validate; enforce explicit price tier only
    A-->>U: Editable taste profile + parser label
    U->>A: Corrected profile; explicit live discovery
    A->>Q: Search named artists/films; Tags for concepts
    Q-->>A: Candidate IDs/names/types
    A-->>U: Validated candidates; exact unique matches preselected
    U->>A: Explicitly confirmed IDs + current profile
    A->>Q: Revalidate lookup IDs (cache where available)
    A->>A: Reject invented/mismatched/duplicate client selections
    A->>Q: Insights place query + confirmed signals + area circle
    Q-->>A: Taste-ranked places
    A->>A: Validate types, coordinates, bounds and optional known tier
    A->>A: Assemble 2–3 stops; preserve source and uncertainty
    A-->>U: Grounded trail, alternative pool, trace, unknowns
    U->>U: Replace stop only within returned alternative pool
```

## Agent responsibilities

`parseTaste` extracts a profile with Gemini or an explicitly labeled rules parser. `TasteAgent.resolve` chooses the lookup action from the reviewed interest type. `TasteAgent.plan` revalidates selected IDs, calls discovery, filters returned data, and assembles a sequence. It records actual actions in a trace rather than pretending a one-shot language answer is a tool workflow.

`QlooClient` owns the private key, URL/parameter construction, response envelopes, timeouts, request budget and short-lived cache. No key, raw provider error or unvalidated response is serialized to the page. The API base is restricted to Qloo-controlled HTTPS API origins; redirects are not followed.

The model is never given venue data to embellish. Product/venue facts are not generated. The server returns only validated fields from Qloo; unknown fields are not promoted to claims. Category interpretation and route ordering are app inferences and are labeled accordingly.

## IDs and stateless requests

The UI may display candidate IDs, but the server never trusts a client-selected ID. Planning repeats the corresponding lookup (usually from memory cache) and requires membership in its result set for the same reviewed profile. This avoids persistent sessions, a database, and signing secrets while keeping the application usable on serverless hosts. Cold functions can make an extra bounded round of lookups; no secret or trusted ID comes from browser storage.

## Geography and practical constraints

Area centers/radii are approximate app choices. WKT longitude precedes latitude; the server checks coordinates and broad Tampa bounds after Qloo returns. It drops records it cannot place rather than guessing. The itinerary starts with a returned dining-tagged option when possible, then considers straight-line proximity within a small part of the Qloo-ranked pool. It does not compute driving/walking times or assert real streets on the schematic.

The date, time, total budget and party size are user context, not verified logistics. A rough price-tier ceiling is separate from the monetary budget. Dietary/accessibility notes remain unverified. No inferred dollar amounts, current hours, live event schedules, bookings or reservation capacity appear.

## Preview isolation

`FixtureDiscovery` is a separate port using original fictional names and coordinates. Only `mode:fixture` with fixtures enabled can select it. Live Qloo failures never switch ports. Production disables fixtures by default. Every preview lookup, place, explanation and trace uses explicit fixture labels; it is for UI testing, not submission evidence.

## Operational boundaries

The API checks JSON size (16 KB), required intent headers and origin; validates inputs with Zod; has a per-instance request limiter using hashed rather than stored raw IPs; and returns bounded safe errors. All provider calls have timeouts and no blind retry loops. In-memory caching/rate counters reset and are not distributed abuse protection. There are no accounts, payments, personal profiles or persistent itinerary storage.
