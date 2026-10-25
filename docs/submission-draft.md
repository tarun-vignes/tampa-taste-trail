# Editable Devpost draft

## Name

Tampa Taste Trail

## Elevator pitch

Turn music, film and food tastes into a Qloo-grounded Tampa outing—with clear sources, editable preferences, and honest logistics.

## Inspiration

[Add your own motivation and audience. Do not claim interviews or testing that you did not perform.]

## What it does

Tampa Taste Trail turns a plain-language outing request into a reviewed cultural profile, resolves artist/film names or genre/concept tags through Qloo, and uses confirmed IDs to discover nearby places. It creates a small sequence from validated results, with alternatives, source labels, an agent trace and visible uncertainty.

The AI interprets preferences rather than inventing venue facts. Qloo is the live candidate source: without its API, no real cultural itinerary is returned. The explicit fictional preview exists for local UI testing only.

## How it is built

Next.js, React and TypeScript provide a responsive web application and private server routes. Gemini structured output extracts an editable profile; Qloo Search/Tags resolves signals; Qloo Insights returns nearby cultural candidates. Server validation checks ID membership, entity types and coordinates. App logic then infers dining/activity roles from returned tags and suggests order by proximity. There are no accounts or payments.

## Why Qloo is central

Selected cultural IDs are real query inputs, not decoration on an LLM answer. Changing confirmed tastes changes the actual Insights signal parameters. All live stop IDs come from returned Qloo places. The model cannot invent a venue or substitute a generic itinerary when discovery fails.

## Trust and limits

Budget, date/time and group size are preferences, not verified prices, business hours or booking capacity. The app displays unknowns and never invents a screening or performance. A taste query is not proof of an individual's preferences or a guaranteed personal match. The map is a schematic, not navigation.

## Verification and progress

[Replace with your actual real Qloo test details after adding an authorized key and confirming the assigned host. No real Qloo flow was tested during initial implementation.]

Gemini extraction has a real provider smoke check; automated tests mock external services. Actual check results live in `docs/verification.md`. No recommendation-quality, user-impact or adoption metric is claimed.

## Challenges / what I learned

[Describe your own experience. Possible implementation topics: grounding ID selection, handling ambiguous tags, keeping prices unknown rather than fabricated, and making geographic filtering verifiable. Do not present these as personal lessons without reviewing them.]

## Built with

Next.js, TypeScript, React, Qloo API, Google Gemini, Zod, CSS, Vitest, Testing Library, Playwright.

## Links and disclosures

- Public demo: [Add actual externally hosted and anonymously verified URL.]
- Public source: [Add actual `tampa-taste-trail` repository URL after authorizing publication.]
- Root license: MIT. API data remains subject to Qloo's access terms.
- Built with Codex assistance. No personal research, impact or learning claims are fabricated.
- Demo video: optional; not required by the verified rules.

## Manual completion

- [ ] Verify eligibility and current event/API rules.
- [ ] Obtain Qloo key; set its exact authorized host and verify real discovery.
- [ ] Confirm source/unknown labels using actual API responses.
- [ ] Authorize a new public repository and external deployment.
- [ ] Test the public app anonymously end to end; fixtures alone do not qualify.
- [ ] Fill in personal sections and actual links.
- [ ] Submit personally before October 30, 2026, 11:45 p.m. EDT.
