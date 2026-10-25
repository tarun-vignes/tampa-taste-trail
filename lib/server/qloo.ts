import { z } from 'zod';
import type { Candidate, Interest, Place, Profile } from '../shared';
import type { Settings } from './config';
import { ServiceError } from './errors';
import { inSearchArea, searchAreas } from './geography';

const idSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  );
const tagIdSchema = z
  .string()
  .max(250)
  .regex(/^urn:tag:[^\s]+$/);
const tagSchema = z.object({
  id: tagIdSchema,
  name: z.string().trim().min(1).max(160),
  type: z.string().optional(),
});
const entitySchema = z.object({
  entity_id: idSchema,
  name: z.string().trim().min(1).max(200),
  type: z.string().max(100),
  subtype: z.string().max(100).optional(),
});
const placeSchema = entitySchema.extend({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  tags: z.array(tagSchema).max(200).optional(),
  properties: z
    .object({
      description: z.string().max(8000).nullable().optional(),
      address: z.string().max(500).nullable().optional(),
      websites: z.array(z.string().max(2000)).max(30).optional(),
      price_level: z.number().int().min(1).max(4).nullable().optional(),
    })
    .optional(),
});
export function resultArray(raw: unknown, key: 'entities' | 'tags'): unknown[] {
  const envelope = z
    .object({
      success: z.boolean().optional(),
      results: z.union([
        z.array(z.unknown()).max(1000),
        z.object({
          entities: z.array(z.unknown()).max(1000).optional(),
          tags: z.array(z.unknown()).max(1000).optional(),
        }),
      ]),
    })
    .safeParse(raw);
  if (!envelope.success || envelope.data.success === false)
    throw new ServiceError(
      502,
      'QLOO_RESPONSE',
      'Qloo returned an unexpected response. No recommendations were substituted.',
    );
  if (Array.isArray(envelope.data.results)) return envelope.data.results;
  const rows = envelope.data.results[key];
  if (!rows)
    throw new ServiceError(
      502,
      'QLOO_RESPONSE',
      'Qloo response did not contain the requested result collection.',
    );
  return rows;
}
export function parseCandidates(raw: unknown, interest: Interest): Candidate[] {
  const rows = resultArray(
    raw,
    interest.lookup === 'tag' ? 'tags' : 'entities',
  );
  const candidates: Candidate[] = [];
  for (const row of rows) {
    if (interest.lookup === 'tag') {
      const tag = tagSchema.safeParse(row);
      if (tag.success)
        candidates.push({
          id: tag.data.id,
          name: tag.data.name,
          kind: 'tag',
          category: tag.data.type || 'Qloo tag',
        });
    } else {
      const entity = entitySchema.safeParse(row);
      const expected =
        interest.category === 'music'
          ? 'urn:entity:artist'
          : 'urn:entity:movie';
      if (
        entity.success &&
        (entity.data.subtype === expected || entity.data.type === expected)
      )
        candidates.push({
          id: entity.data.entity_id,
          name: entity.data.name,
          kind: 'entity',
          category: expected,
        });
    }
  }
  if (rows.length && !candidates.length)
    throw new ServiceError(
      502,
      'QLOO_RESPONSE',
      'Qloo taste candidates could not be validated. Change the term or retry.',
    );
  return candidates
    .filter(
      (candidate, index, list) =>
        list.findIndex((c) => c.id === candidate.id) === index,
    )
    .slice(0, 5);
}
export function parsePlaces(
  raw: unknown,
  profile: Profile,
): { places: Place[]; discarded: number } {
  const rows = resultArray(raw, 'entities');
  const places: Place[] = [];
  let discarded = 0;
  for (const row of rows) {
    const parsed = placeSchema.safeParse(row);
    if (
      !parsed.success ||
      !(
        parsed.data.subtype === 'urn:entity:place' ||
        parsed.data.type === 'urn:entity:place'
      )
    ) {
      discarded++;
      continue;
    }
    const item = parsed.data;
    const point = { latitude: item.location.lat, longitude: item.location.lon };
    if (
      !inSearchArea(point, profile.area) ||
      places.some((p) => p.id === item.entity_id) ||
      (profile.priceLevel !== null &&
        item.properties?.price_level != null &&
        item.properties.price_level > profile.priceLevel)
    ) {
      discarded++;
      continue;
    }
    const website =
      item.properties?.websites?.find((value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch {
          return false;
        }
      }) || null;
    places.push({
      id: item.entity_id,
      name: item.name,
      description: item.properties?.description?.slice(0, 2000) || null,
      address: item.properties?.address || null,
      ...point,
      tags: (item.tags || [])
        .slice(0, 20)
        .map(({ id, name }) => ({ id, name })),
      website,
      priceLevel: item.properties?.price_level ?? null,
    });
  }
  return { places, discarded };
}
export interface DiscoveryPort {
  resolve(interest: Interest): Promise<Candidate[]>;
  discover(
    profile: Profile,
    signals: Candidate[],
  ): Promise<{ places: Place[]; discarded: number }>;
}
export class QlooClient implements DiscoveryPort {
  private cache = new Map<string, { expires: number; value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  private calls: number[] = [];
  constructor(
    private settings: Settings,
    private transport: typeof fetch = fetch,
  ) {}
  private async get(
    path: '/search' | '/v2/tags' | '/v2/insights',
    parameters: Record<string, string>,
  ): Promise<unknown> {
    if (!this.settings.qlooKey)
      throw new ServiceError(
        503,
        'QLOO_MISSING',
        'Qloo is not configured. Add QLOO_API_KEY on the server. You may explicitly open a fictional preview; no live matches are available.',
      );
    const url = new URL(path, this.settings.qlooBase);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(key, value);
    const key = url.toString();
    const existing = this.cache.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    const pending = this.pending.get(key);
    if (pending) return pending;
    this.calls = this.calls.filter((time) => Date.now() - time < 60000);
    if (this.calls.length >= 30)
      throw new ServiceError(
        429,
        'LOCAL_QLOO_LIMIT',
        'The app’s local Qloo request budget is reached. Wait a minute before trying again.',
      );
    this.calls.push(Date.now());
    const request = (async () => {
      try {
        const response = await this.transport(key, {
          headers: {
            Accept: 'application/json',
            'X-Api-Key': this.settings.qlooKey,
          },
          redirect: 'error',
          signal: AbortSignal.timeout(12000),
          cache: 'no-store',
        });
        if (response.status === 404 && path === '/search')
          return { success: true, results: [] };
        if (response.status === 401 || response.status === 403)
          throw new ServiceError(
            503,
            'QLOO_AUTH',
            'Qloo rejected this key or API host. Verify the exact host and access instructions supplied by your key issuer.',
          );
        if (response.status === 429)
          throw new ServiceError(
            429,
            'QLOO_LIMIT',
            'Qloo rate or quota limit reached. Wait before retrying and check your event access limits.',
          );
        if (!response.ok)
          throw new ServiceError(
            502,
            'QLOO_UNAVAILABLE',
            'Qloo could not complete discovery. Broaden your request or retry later.',
          );
        const text = await response.text();
        if (text.length > 1500000) throw new Error('Response too large');
        const value: unknown = JSON.parse(text);
        resultArray(value, path === '/v2/tags' ? 'tags' : 'entities');
        if (this.cache.size >= 64)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { value, expires: Date.now() + 300000 });
        return value;
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError(
          502,
          'QLOO_NETWORK',
          'Qloo timed out or returned unreadable data. No mock results were substituted.',
        );
      }
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  async resolve(interest: Interest): Promise<Candidate[]> {
    if (interest.lookup === 'tag')
      return parseCandidates(
        await this.get('/v2/tags', {
          'filter.query': interest.term,
          take: '5',
        }),
        interest,
      );
    const type =
      interest.category === 'music' ? 'urn:entity:artist' : 'urn:entity:movie';
    return parseCandidates(
      await this.get('/search', {
        query: interest.term,
        types: type,
        take: '5',
      }),
      interest,
    );
  }
  async discover(profile: Profile, signals: Candidate[]) {
    const center = searchAreas[profile.area];
    const query: Record<string, string> = {
      'filter.type': 'urn:entity:place',
      'filter.location': `POINT(${center.longitude} ${center.latitude})`,
      'filter.location.radius': String(center.radius),
      take: '12',
    };
    const entities = signals
        .filter((s) => s.kind === 'entity')
        .map((s) => s.id),
      tags = signals.filter((s) => s.kind === 'tag').map((s) => s.id);
    if (!entities.length && !tags.length)
      throw new ServiceError(
        400,
        'NO_SIGNALS',
        'Choose at least one Qloo-resolved taste signal.',
      );
    if (entities.length)
      query['signal.interests.entities'] = entities.join(',');
    if (tags.length) query['signal.interests.tags'] = tags.join(',');
    if (profile.priceLevel !== null)
      query['filter.price_level.max'] = String(profile.priceLevel);
    return parsePlaces(await this.get('/v2/insights', query), profile);
  }
}
