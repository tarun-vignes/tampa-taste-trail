# Verification record

## Public live verification — October 27, 2026

- Fixed candidate classification so a missing singular `type` does not reject an explicit compatible `subtype` or `types` collection. A UUID, nonempty name and explicit requested artist/movie/place classification remain required. Wrong categories and malformed IDs remain rejected.
- Independently reproduced the original HTTP 502 failures for Burna Boy and Interstellar; spicy-food tag resolution succeeded. After deployment, `/api/resolve` returned HTTP 200 with five candidates and an exact match for each of Burna Boy, Interstellar and spicy food.
- `/api/plan` returned HTTP 200 using all three confirmed IDs: two entity signals and one tag signal. Eleven nearby candidates passed validation and two real stops were assembled. This verifies integration, not subjective recommendation quality, operating hours or budget fit.
- Actual public Chrome UI passed signal confirmation and two-stop rendering with no browser runtime errors. The browser harness supplied the known input profile instead of invoking Gemini; Qloo lookups, ID revalidation and discovery were real hosted requests. This run does not claim a fresh Gemini test.
- Local suite: 48 tests passed, plus lint and TypeScript. The preceding parser build and formatting checks passed. GitHub CI for commits `ee46c5a` and `05895e3` passed, including production build and bounded secret checks.
- Validation errors now include only bounded known field types and allowlisted category labels in a machine-readable diagnostic. A test verifies that arbitrary provider values and credentials are never reflected. No raw provider snapshots or keys were written into project files.
- Live site: https://tampa-taste-trail.onrender.com . Source: https://github.com/tarun-vignes/tampa-taste-trail . Hosting remains managed in the owner's Render account. No Devpost submission was performed.

## Initial local verification — October 24, 2026

Checked locally on October 24, 2026, using Windows, Node 22.19.0 and Chrome.

| Check                             | Observed result                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm.cmd test`                    | 46 tests passed across four files: core features/provider parsing, agent grounding, HTTP boundary, React UI. External services mocked.                 |
| `npm.cmd run lint`                | Passed.                                                                                                                                                |
| `npm.cmd run typecheck`           | Passed.                                                                                                                                                |
| `npm.cmd run format:check`        | Passed.                                                                                                                                                |
| `npm.cmd run build`               | Next.js production build passed.                                                                                                                       |
| `npm.cmd run check:browser`       | Passed against the production server in real headless Chrome at desktop 1440×960 and mobile 390×844.                                                   |
| `npm.cmd run check:ai`            | Real Gemini extraction passed using the configured private key. A $100 group budget remained separate from the unknown restaurant price tier.          |
| `npm.cmd run check:secrets`       | Passed; no configured secret values found in checked source/build files.                                                                               |
| `npm.cmd audit --omit=dev --json` | Earlier successful check reported zero runtime vulnerabilities. Final repeat failed to reach the registry audit endpoint; no new result was available. |
| Production HTTP smoke             | `/`, `/healthz` and `/api/status` returned 200. Status exposes availability flags, not secrets.                                                        |
| Real Qloo discovery               | **Not tested: no Qloo credential available.** No live recommendation-quality claim is made.                                                            |

Browser checks cover editable extraction, explicit fictional discovery, signal confirmation, itinerary display, alternative replacement, invalidation after preference changes, and a mocked API failure. No horizontal overflow or browser runtime errors were observed. The script forces rule extraction and fictional data; it does not exercise real AI or Qloo calls. Actual screenshots were inspected and are stored locally in ignored `artifacts/screenshots/`.

The browser run uncovered a valid local request rejected because Next normalized its internal URL to localhost. The origin check now compares against the incoming Host when APP_ORIGIN is not configured; an explicit APP_ORIGIN still takes precedence. A regression test covers both cases.

These checks do not establish full accessibility compliance, real-world outing suitability, verified business logistics, or deployed availability. No public deployment, GitHub publication, user study or Devpost submission was performed. The prepared GitHub workflow has not run remotely.

Before submission, obtain an authorized Qloo key and assigned API host, run `npm.cmd run check:qloo`, inspect real returned entities and provenance, then publish/deploy with authorization and verify the actual public app anonymously. Configure APP_ORIGIN to the final HTTPS origin when hosting.
