import { describe, it, expect, vi } from 'vitest';
import type { Candidate } from '../lib/shared';
import { readSettings } from '../lib/server/config';
import { TasteAgent } from '../lib/server/agent';
import { replaceStop } from '../lib/trail';
import { place, profile } from './helpers';
import type { DiscoveryPort } from '../lib/server/qloo';

const signal: Candidate = {
  id: 'urn:tag:genre:music:afrobeats',
  name: 'Afrobeats',
  kind: 'tag',
  category: 'music',
};
const one = { ...profile, interests: [profile.interests[0]] };
const selected = [{ interestIndex: 0, id: signal.id }];
function port(places = [place]): DiscoveryPort {
  return {
    resolve: vi.fn().mockResolvedValue([signal]),
    discover: vi.fn().mockResolvedValue({ places, discarded: 0 }),
  };
}
describe('grounded agent orchestration', () => {
  it('uses the selected, revalidated Qloo signal to obtain every itinerary ID', async () => {
    const api = port([
      place,
      {
        ...place,
        id: '10000000-0000-0000-0000-000000000002',
        name: 'Mock activity',
        latitude: 27.951,
        tags: [
          { id: 'urn:tag:category:place:art_gallery', name: 'Art gallery' },
        ],
      },
    ]);
    const plan = await new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      api,
    ).plan({ profile: one, mode: 'live', selected });
    expect(plan.stops.map((stop) => stop.entity.id)).toEqual([
      place.id,
      '10000000-0000-0000-0000-000000000002',
    ]);
    expect(plan.sourceLabel).toContain('Qloo');
    expect(plan.stops[0].signals[0].id).toBe(signal.id);
    expect(plan.budgetStatus).toBe('not_verified');
    expect(api.discover).toHaveBeenCalledWith(one, [signal]);
    expect(plan.trace.map((step) => step.action)).toEqual([
      'resolve',
      'validate',
      'recommend',
      'assemble',
    ]);
  });
  it('rejects invented or mismatched client IDs before recommendation calls', async () => {
    const api = port();
    const agent = new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      api,
    );
    await expect(
      agent.plan({
        profile: one,
        mode: 'live',
        selected: [{ interestIndex: 0, id: 'invented' }],
      }),
    ).rejects.toThrow('not among');
    expect(api.discover).not.toHaveBeenCalled();
  });
  it('does not accept duplicate selections for one interest', async () => {
    const agent = new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      port(),
    );
    await expect(
      agent.plan({
        profile: one,
        mode: 'live',
        selected: [...selected, ...selected],
      }),
    ).rejects.toThrow('at most one');
  });
  it('changes the query signals when cultural preferences change', async () => {
    const jazz = { ...signal, id: 'urn:tag:genre:music:jazz', name: 'Jazz' };
    const api: DiscoveryPort = {
      resolve: vi.fn(async (interest) => [
        interest.term === 'Jazz' ? jazz : signal,
      ]),
      discover: vi.fn().mockResolvedValue({ places: [place], discarded: 0 }),
    };
    const agent = new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      api,
    );
    await agent.plan({ profile: one, mode: 'live', selected });
    await agent.plan({
      profile: { ...one, interests: [{ ...one.interests[0], term: 'Jazz' }] },
      mode: 'live',
      selected: [{ interestIndex: 0, id: jazz.id }],
    });
    expect(vi.mocked(api.discover).mock.calls[0][1][0].id).not.toBe(
      vi.mocked(api.discover).mock.calls[1][1][0].id,
    );
  });
  it('does not invent a second stop or fill empty discovery with a local catalog', async () => {
    const agent = new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      port(),
    );
    const plan = await agent.plan({ profile: one, mode: 'live', selected });
    expect(plan.stops).toHaveLength(1);
    expect(plan.warnings.some((w) => w.includes('No second venue'))).toBe(true);
    const empty = await new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      port([]),
    ).plan({ profile: one, mode: 'live', selected });
    expect(empty.stops).toEqual([]);
    expect(empty.warnings.some((w) => w.includes('No verifiable'))).toBe(true);
  });
  it('labels explicit fixtures and never passes them off as real Qloo', async () => {
    const agent = new TasteAgent(readSettings({ ALLOW_FIXTURE_DEMO: 'true' }));
    const resolved = await agent.resolve({ profile: one, mode: 'fixture' });
    const plan = await agent.plan({
      profile: one,
      mode: 'fixture',
      selected: [{ interestIndex: 0, id: resolved.items[0].exactId }],
    });
    expect(plan.mode).toBe('fixture');
    expect(plan.stops[0].sourceLabel).toContain('Fictional');
    expect(plan.trace.some((step) => step.source === 'Qloo')).toBe(false);
    await expect(agent.resolve({ profile: one, mode: 'live' })).rejects.toThrow(
      'QLOO_API_KEY',
    );
  });
  it('can disable fixture mode for a public deployment', async () => {
    const agent = new TasteAgent(readSettings({ NODE_ENV: 'production' }));
    await expect(
      agent.resolve({ profile: one, mode: 'fixture' }),
    ).rejects.toThrow('disabled');
  });
  it('replaces a stop only with another candidate from the validated pool', async () => {
    const places = [
      place,
      ...[2, 3].map((n) => ({
        ...place,
        id: `10000000-0000-0000-0000-00000000000${n}`,
        name: `Mock alternative ${n}`,
      })),
    ];
    const plan = await new TasteAgent(
      readSettings({ QLOO_API_KEY: 'fixture' }),
      port(places),
    ).plan({ profile: one, mode: 'live', selected });
    const id = plan.alternatives[0].id;
    const changed = replaceStop(plan, 0, id);
    expect(changed.stops[0].entity.id).toBe(id);
    expect(changed.stops[0].sourceLabel).toContain('Qloo');
    expect(
      changed.alternatives.some((p) => p.id === plan.stops[0].entity.id),
    ).toBe(true);
    expect(() => replaceStop(plan, 0, 'invented')).toThrow();
  });
});
