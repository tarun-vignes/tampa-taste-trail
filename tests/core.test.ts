import { describe, it, expect, vi } from 'vitest';
import { parseInputSchema, profileSchema } from '../lib/shared';
import { readSettings } from '../lib/server/config';
import { explicitPriceTier, parseTaste, ruleProfile } from '../lib/server/ai';
import {
  parseCandidates,
  parsePlaces,
  QlooClient,
  resultArray,
  candidateDiagnostic,
} from '../lib/server/qloo';
import { distanceMeters, inSearchArea } from '../lib/server/geography';
import { profile, rawPlace } from './helpers';

describe('preference extraction and validation', () => {
  it('never maps a dollar budget to a restaurant tier', () => {
    expect(explicitPriceTier('Dinner under $100 for two')).toBeNull();
    expect(explicitPriceTier('Dinner at a $$ restaurant')).toBe(2);
    expect(explicitPriceTier('Price level 3 is okay')).toBe(3);
  });
  it('extracts supported sample tastes, a group budget, party size and pace', () => {
    const result = ruleProfile(
      'Afrobeats, sci-fi, and spicy food. A relaxed evening in Tampa for two under $100.',
    );
    expect(result.interests.map((i) => i.term)).toEqual([
      'Afrobeats',
      'Science Fiction',
      'Spicy',
    ]);
    expect(result.budgetCents).toBe(10000);
    expect(result.partySize).toBe(2);
    expect(result.pace).toBe('relaxed');
  });
  it('does not mistake party for an art preference', () => {
    expect(
      ruleProfile('Jazz music for a party of 3').interests.map((i) => i.term),
    ).toEqual(['Jazz']);
  });
  it('validates dates, time, party and nonnegative cent budgets', () => {
    expect(() =>
      profileSchema.parse({ ...profile, date: '2026-02-30' }),
    ).toThrow();
    expect(() => profileSchema.parse({ ...profile, time: '25:00' })).toThrow();
    expect(() => profileSchema.parse({ ...profile, partySize: 0 })).toThrow();
    expect(() =>
      profileSchema.parse({ ...profile, budgetCents: 100.5 }),
    ).toThrow();
    expect(() =>
      profileSchema.parse({ ...profile, budgetCents: -1 }),
    ).toThrow();
    expect(() => profileSchema.parse({ ...profile, interests: [] })).toThrow();
    expect(() => parseInputSchema.parse({ prompt: 'hi' })).toThrow();
    expect(() =>
      parseInputSchema.parse({ prompt: 'x'.repeat(1501) }),
    ).toThrow();
  });
  it('labels rules when a model key is missing and never calls a provider', async () => {
    const transport = vi.fn<typeof fetch>();
    const result = await parseTaste(
      { prompt: 'Jazz and coffee in Tampa' },
      readSettings({}),
      transport,
    );
    expect(result.parser).toBe('rules');
    expect(result.model).toBeNull();
    expect(transport).not.toHaveBeenCalled();
  });
  it('validates structured AI extraction without accepting venue or ID inventions', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(profile) }] } },
          ],
        }),
      ),
    );
    const result = await parseTaste(
      { prompt: 'A Tampa outing for two with jazz' },
      readSettings({ GEMINI_API_KEY: 'test-key' }),
      transport,
    );
    expect(result.parser).toBe('gemini');
    expect(result.profile).toEqual(profile);
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ ...profile, venue: 'invented' }) },
                ],
              },
            },
          ],
        }),
      ),
    );
    await expect(
      parseTaste(
        { prompt: 'An outing in Tampa with jazz' },
        readSettings({ GEMINI_API_KEY: 'test-key' }),
        transport,
      ),
    ).rejects.toThrow('invalid profile');
  });
  it('does not silently fall back on AI failure', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 429 }));
    await expect(
      parseTaste(
        { prompt: 'A Tampa outing for two with jazz' },
        readSettings({ GEMINI_API_KEY: 'test-key' }),
        transport,
      ),
    ).rejects.toThrow('Gemini');
  });
});
describe('Qloo response contracts', () => {
  it('exposes only allowlisted schema diagnostics, never arbitrary provider values', () => {
    const diagnostic = candidateDiagnostic({
      entity_id: 'private-id',
      name: 'private-name',
      type: 'private-token',
      api_key: 'private-key',
      types: ['urn:entity:artist', 'private-secret'],
    });
    const text = JSON.stringify(diagnostic);
    expect(text).not.toContain('private-');
    expect(text).not.toContain('api_key');
    expect(text).toContain('urn:entity:artist');
    expect(diagnostic.fields).toMatchObject({
      entity_id: 'string',
      types: 'array',
    });
  });
  it('validates explicit search type arrays and subtype-only records without inferring a category', () => {
    const identity = {
      entity_id: '10000000-0000-0000-0000-000000000009',
      name: 'Example artist',
    };
    const interest = {
      term: 'Example artist',
      category: 'music',
      lookup: 'entity',
    } as const;
    for (const classification of [
      { types: ['urn:entity:artist'] },
      { subtype: 'urn:entity:artist' },
      { type: null, subtype: 'urn:entity:artist' },
      { type: 'urn:entity:artist' },
    ]) {
      expect(
        parseCandidates(
          { results: [{ ...identity, ...classification }] },
          interest,
        )[0].id,
      ).toBe(identity.entity_id);
    }
    for (const classification of [
      {},
      { types: ['urn:entity:movie'] },
      { types: ['artist'] },
      { types: 'urn:entity:artist' },
    ]) {
      expect(() =>
        parseCandidates(
          { results: [{ ...identity, ...classification }] },
          interest,
        ),
      ).toThrow();
    }
    expect(() =>
      parseCandidates(
        {
          results: [
            { ...identity, entity_id: 'fake', types: ['urn:entity:artist'] },
          ],
        },
        interest,
      ),
    ).toThrow();
  });
  it('accepts documented result collections and rejects missing or failed envelopes', () => {
    expect(resultArray({ success: true, results: [] }, 'entities')).toEqual([]);
    expect(resultArray({ results: { tags: [] } }, 'tags')).toEqual([]);
    expect(() =>
      resultArray({ success: false, results: [] }, 'entities'),
    ).toThrow();
    expect(() => resultArray({ results: {} }, 'entities')).toThrow();
    expect(() => resultArray({ entities: [] }, 'entities')).toThrow();
  });
  it('only exposes validated tag and entity candidate IDs from provider results', () => {
    expect(
      parseCandidates(
        {
          results: { tags: [{ id: 'urn:tag:genre:music:jazz', name: 'Jazz' }] },
        },
        { term: 'Jazz', category: 'music', lookup: 'tag' },
      )[0].id,
    ).toBe('urn:tag:genre:music:jazz');
    const raw = {
      entity_id: '10000000-0000-0000-0000-000000000009',
      name: 'Named movie',
      type: 'urn:entity',
      subtype: 'urn:entity:movie',
    };
    expect(
      parseCandidates(
        { results: [raw] },
        { term: 'Named movie', category: 'film', lookup: 'entity' },
      )[0].name,
    ).toBe('Named movie');
    expect(() =>
      parseCandidates(
        { results: [{ id: 'made-up', name: 'Fake' }] },
        { term: 'Jazz', category: 'music', lookup: 'tag' },
      ),
    ).toThrow();
  });
  it('drops malformed, duplicate, missing-coordinate, wrong-type and nonlocal venues', () => {
    const valid = rawPlace();
    const result = parsePlaces(
      {
        results: {
          entities: [
            valid,
            valid,
            {
              ...valid,
              entity_id: '10000000-0000-0000-0000-000000000002',
              location: { lat: 40.7, lon: -74 },
            },
            { ...valid, location: undefined },
            { ...valid, subtype: 'urn:entity:movie' },
          ],
        },
      },
      profile,
    );
    expect(result.places).toHaveLength(1);
    expect(result.discarded).toBe(4);
    expect(result.places[0].website).toBe('https://example.com/');
    expect(result.places[0].id).toBe(valid.entity_id);
  });
  it('enforces an explicit known price tier without inventing dollar totals', () => {
    const result = parsePlaces(
      { results: { entities: [rawPlace()] } },
      { ...profile, priceLevel: 1 },
    );
    expect(result.places).toHaveLength(0);
    const raw = rawPlace();
    expect(
      parsePlaces(
        {
          results: {
            entities: [
              { ...raw, properties: { ...raw.properties, price_level: null } },
            ],
          },
        },
        { ...profile, priceLevel: 1 },
      ).places[0].priceLevel,
    ).toBeNull();
  });
  it('uses geography rather than trusting a potentially ignored location filter', () => {
    expect(
      distanceMeters(
        { latitude: 27.95, longitude: -82.45 },
        { latitude: 27.95, longitude: -82.45 },
      ),
    ).toBe(0);
    expect(inSearchArea({ latitude: 27.95, longitude: -82.45 }, 'Tampa')).toBe(
      true,
    );
    expect(inSearchArea({ latitude: -82.45, longitude: 27.95 }, 'Tampa')).toBe(
      false,
    );
  });
});
describe('Qloo transport', () => {
  const settings = readSettings({ QLOO_API_KEY: 'fixture-secret' });
  it('requires a key without requesting or substituting anything', async () => {
    const transport = vi.fn<typeof fetch>();
    const client = new QlooClient(readSettings({}), transport);
    await expect(client.resolve(profile.interests[0])).rejects.toThrow(
      'not configured',
    );
    expect(transport).not.toHaveBeenCalled();
  });
  it('uses documented parameters, server header auth and a geographic check', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: {
              tags: [
                { id: 'urn:tag:genre:music:afrobeats', name: 'Afrobeats' },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            results: { entities: [rawPlace()] },
          }),
        ),
      );
    const client = new QlooClient(settings, transport);
    const signals = await client.resolve(profile.interests[0]);
    await client.discover(profile, signals);
    const first = new URL(String(transport.mock.calls[0][0])),
      second = new URL(String(transport.mock.calls[1][0]));
    expect(first.pathname).toBe('/v2/tags');
    expect(first.searchParams.get('filter.query')).toBe('Afrobeats');
    expect(second.pathname).toBe('/v2/insights');
    expect(second.searchParams.get('filter.type')).toBe('urn:entity:place');
    expect(second.searchParams.get('signal.interests.tags')).toBe(
      signals[0].id,
    );
    expect(second.searchParams.get('filter.location')).toBe(
      'POINT(-82.4572 27.9506)',
    );
    expect(
      (transport.mock.calls[0][1]?.headers as Record<string, string>)[
        'X-Api-Key'
      ],
    ).toBe('fixture-secret');
    expect(String(transport.mock.calls[0][0])).not.toContain('fixture-secret');
    expect(transport.mock.calls[0][1]?.redirect).toBe('error');
  });
  it('resolves named artist queries through Search with its type parameter', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    const client = new QlooClient(settings, transport);
    await client.resolve({
      term: 'Artist',
      category: 'music',
      lookup: 'entity',
    });
    const url = new URL(String(transport.mock.calls[0][0]));
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('types')).toBe('urn:entity:artist');
  });
  it.each([401, 403, 429, 500])(
    'surfaces HTTP %s without fallback',
    async (status) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status }));
      const client = new QlooClient(settings, transport);
      await expect(client.resolve(profile.interests[0])).rejects.toThrow();
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it('coalesces identical concurrent requests without sharing secrets in output', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ results: { tags: [] } })),
      );
    const client = new QlooClient(settings, transport);
    const results = await Promise.all([
      client.resolve(profile.interests[0]),
      client.resolve(profile.interests[0]),
    ]);
    expect(results).toEqual([[], []]);
    expect(transport).toHaveBeenCalledTimes(1);
    await client.resolve(profile.interests[0]);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('accepts Search 404 as no matches but not a missing Insights endpoint', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 404 }));
    const client = new QlooClient(settings, transport);
    expect(
      await client.resolve({
        term: 'Unknown',
        category: 'film',
        lookup: 'entity',
      }),
    ).toEqual([]);
    await expect(
      client.discover(profile, [
        {
          id: 'urn:tag:genre:music:jazz',
          name: 'Jazz',
          kind: 'tag',
          category: 'music',
        },
      ]),
    ).rejects.toThrow();
  });
  it('rejects credential exfiltration through a configured non-Qloo host', () => {
    expect(() =>
      readSettings({ QLOO_BASE_URL: 'https://evil.example.com' }),
    ).toThrow();
    expect(() =>
      readSettings({ QLOO_BASE_URL: 'https://api.qloo.com.evil.example/' }),
    ).toThrow();
    expect(() =>
      readSettings({ QLOO_BASE_URL: 'http://api.qloo.com/' }),
    ).toThrow();
  });
});
