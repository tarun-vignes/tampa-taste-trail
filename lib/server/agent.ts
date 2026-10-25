import {
  planInputSchema,
  resolutionInputSchema,
  type Mode,
  type Plan,
  type Profile,
  type ResolvedTaste,
} from '../shared';
import { placeRole, makeStop } from '../trail';
import type { Settings } from './config';
import { ServiceError } from './errors';
import { FixtureDiscovery } from './fixtures';
import { QlooClient, type DiscoveryPort } from './qloo';
import { distanceMeters } from './geography';

const normalize = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('en-US').trim();
export class TasteAgent {
  private live: DiscoveryPort;
  private fixture = new FixtureDiscovery();
  constructor(
    private settings: Settings,
    live?: DiscoveryPort,
  ) {
    this.live = live || new QlooClient(settings);
  }
  private port(mode: Mode) {
    if (mode === 'fixture') {
      if (!this.settings.fixtures)
        throw new ServiceError(
          403,
          'FIXTURE_DISABLED',
          'Fictional previews are disabled on this deployment.',
        );
      return this.fixture;
    }
    if (!this.settings.qlooKey)
      throw new ServiceError(
        503,
        'QLOO_MISSING',
        'Real Qloo discovery needs a server-side QLOO_API_KEY. No recommendations were substituted. You can explicitly choose the fictional UI preview if enabled.',
      );
    return this.live;
  }
  async resolve(input: unknown): Promise<ResolvedTaste> {
    const { profile, mode } = resolutionInputSchema.parse(input);
    const client = this.port(mode);
    const items: ResolvedTaste['items'] = [];
    // Bound provider concurrency to two; up to four interests, no recursive search.
    for (let index = 0; index < profile.interests.length; index += 2) {
      const chunk = await Promise.all(
        profile.interests
          .slice(index, index + 2)
          .map(async (interest, offset) => {
            const candidates = await client.resolve(interest);
            const exact = candidates.filter(
              (c) => normalize(c.name) === normalize(interest.term),
            );
            return {
              interest,
              interestIndex: index + offset,
              candidates,
              exactId: exact.length === 1 ? exact[0].id : null,
            };
          }),
      );
      items.push(...chunk);
    }
    return {
      items,
      mode,
      sourceLabel:
        mode === 'live'
          ? 'Qloo lookup results'
          : 'Fictional fixture lookups — not Qloo',
      warnings: items
        .filter((item) => !item.candidates.length)
        .map(
          (item) =>
            `No ${mode === 'live' ? 'Qloo' : 'fixture'} match for “${item.interest.term}”. Edit or remove it.`,
        ),
    };
  }
  async plan(input: unknown): Promise<Plan> {
    const request = planInputSchema.parse(input);
    const { profile, mode, selected } = request;
    if (
      new Set(selected.map((item) => item.interestIndex)).size !==
      selected.length
    )
      throw new ServiceError(
        400,
        'DUPLICATE_SIGNAL',
        'Choose at most one match per interest.',
      );
    const resolved = await this.resolve({ profile, mode });
    const signals = selected
      .map((selection) => {
        const candidate = resolved.items
          .find((item) => item.interestIndex === selection.interestIndex)
          ?.candidates.find((item) => item.id === selection.id);
        if (!candidate)
          throw new ServiceError(
            400,
            'UNVERIFIED_SIGNAL',
            'A selected ID is not among the current Qloo results for this taste profile. Resolve your signals again.',
          );
        return candidate;
      })
      .filter(
        (candidate, index, list) =>
          list.findIndex((item) => item.id === candidate.id) === index,
      );
    const discovered = await this.port(mode).discover(profile, signals);
    let available = discovered.places.filter(
      (place) =>
        profile.focus === 'mixed' || placeRole(place) === profile.focus,
    );
    const warnings = [
      ...resolved.warnings,
      ...profile.interests.flatMap((interest, index) =>
        selected.some((item) => item.interestIndex === index)
          ? []
          : [
              `“${interest.term}” was not used because no lookup match was confirmed.`,
            ],
      ),
      'Total budget cannot be verified: no current menu, ticket, transport or reservation prices are supplied.',
      `Your date${profile.date ? ` (${profile.date})` : ''} and ${profile.time} start are planning preferences, not verified operating hours or event times.`,
      'Taste-based ranking is not proof that every dietary, accessibility or practical requirement is met.',
      ...profile.notes.map((note) => `User/AI note, not verified: ${note}`),
    ];
    if (mode === 'fixture')
      warnings.unshift(
        'Fictional UI preview. No Qloo request was made; names and coordinates are original test fixtures, not real Tampa venues.',
      );
    if (discovered.discarded)
      warnings.push(
        `${discovered.discarded} returned records were removed for invalid/missing coordinates, wrong type, duplicates, outside-area locations, or a known tier above your ceiling.`,
      );
    if (profile.priceLevel !== null)
      warnings.push(
        `Requested a Qloo price-level ceiling of ${profile.priceLevel}/4; this is a rough restaurant tier, not a dollar quote. Unknown tiers remain unverified.`,
      );
    if (!available.length)
      warnings.push(
        'No verifiable nearby stops remain. Broaden the area, remove a taste constraint, or change the outing focus.',
      );
    const ordered: typeof available = [];
    // Preserve Qloo as candidate source and taste rank. Start with its highest-ranked
    // dining result when available; arrange the next small set by straight-line proximity.
    const first =
      profile.focus === 'mixed'
        ? available.find((place) => placeRole(place) === 'dining')
        : available[0];
    if (first) {
      ordered.push(first);
      available = available.filter((place) => place.id !== first.id);
    }
    const limit = profile.pace === 'relaxed' ? 2 : 3;
    while (ordered.length < limit && available.length) {
      const next =
        ordered.length === 0
          ? available[0]
          : [...available.slice(0, 6)].sort(
              (a, b) =>
                distanceMeters(ordered[ordered.length - 1], a) -
                distanceMeters(ordered[ordered.length - 1], b),
            )[0];
      ordered.push(next);
      available = available.filter((place) => place.id !== next.id);
    }
    if (ordered.length === 1)
      warnings.push(
        'Only one suitable stop was found. No second venue or event was invented.',
      );
    return {
      mode,
      profile,
      signals,
      stops: ordered.map((entity, index) =>
        makeStop(entity, index + 1, signals, profile, mode),
      ),
      alternatives: available.slice(0, 6),
      warnings: [...new Set(warnings)],
      trace: [
        {
          action: 'resolve',
          detail: `Resolved ${profile.interests.length} editable taste terms through ${mode === 'live' ? 'Qloo Search/Tags' : 'fictional fixture lookups'}.`,
          source: mode === 'live' ? 'Qloo' : 'Fictional fixture',
        },
        {
          action: 'validate',
          detail: `Verified ${signals.length} selected IDs against the current lookup results. Client and model IDs are never accepted on trust.`,
          source: 'App',
        },
        {
          action: 'recommend',
          detail: `Queried nearby place discovery with ${signals.filter((s) => s.kind === 'entity').length} entity and ${signals.filter((s) => s.kind === 'tag').length} tag signals; ${discovered.places.length} geographic candidates survived validation.`,
          source: mode === 'live' ? 'Qloo' : 'Fictional fixture',
        },
        {
          action: 'assemble',
          detail: `Assembled ${ordered.length} stops from those results using category tags and straight-line proximity. No travel time, booking or availability claim.`,
          source: 'App',
        },
      ],
      retrievedAt: new Date().toISOString(),
      budgetStatus: 'not_verified',
      sourceLabel:
        mode === 'live'
          ? 'Qloo cultural discovery + app ordering'
          : 'Fictional preview + app ordering',
      discardedCount: discovered.discarded,
    };
  }
}
export function profileSummary(profile: Profile) {
  return `${profile.partySize} guests · ${profile.area} · ${profile.interests.map((item) => item.term).join(', ')}`;
}
