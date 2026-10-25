// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Planner from '../components/Planner';
import { requestJson } from '../lib/client';
import { TasteAgent } from '../lib/server/agent';
import { readSettings } from '../lib/server/config';
import { profile } from './helpers';
import type { Plan, ResolvedTaste } from '../lib/shared';

vi.mock('../lib/client', () => ({ requestJson: vi.fn() }));
const config = {
  qlooAvailable: false,
  aiAvailable: false,
  aiModel: null,
  fixtureAvailable: true,
  limits: { interests: 4, maxStops: 3 },
};
let resolved: ResolvedTaste, plan: Plan;
beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(requestJson).mockReset();
  const agent = new TasteAgent(readSettings({ ALLOW_FIXTURE_DEMO: 'true' }));
  resolved = await agent.resolve({ profile, mode: 'fixture' });
  plan = await agent.plan({
    profile,
    mode: 'fixture',
    selected: resolved.items.map((item) => ({
      interestIndex: item.interestIndex,
      id: item.exactId,
    })),
  });
  vi.mocked(requestJson).mockImplementation(async (path) => {
    if (path === '/api/status') return config;
    if (path === '/api/parse')
      return {
        profile,
        parser: 'rules',
        model: null,
        notice: 'Rule-based extraction — no generative AI used.',
      };
    if (path === '/api/resolve') return resolved;
    if (path === '/api/plan') return plan;
    throw new Error('Unexpected test route');
  });
});
afterEach(cleanup);
async function parse() {
  const button = await screen.findByRole('button', {
    name: /Shape my taste profile/,
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByRole('region', { name: 'Taste profile' });
}
async function preview() {
  await parse();
  fireEvent.click(
    screen.getByRole('button', { name: 'Explore fictional preview' }),
  );
  await screen.findByRole('heading', {
    name: 'Confirm the cultural connections.',
  });
}
describe('taste-aware outing UI', () => {
  it('shows welcome and missing credentials without presenting any fake live stops', async () => {
    render(<Planner />);
    expect(await screen.findByText('Qloo key not configured')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Your outing' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /A few things you love/ }),
    ).toBeVisible();
  });
  it('makes extracted tastes editable before any Qloo search', async () => {
    render(<Planner />);
    await parse();
    expect(screen.getByLabelText('Taste 1')).toHaveValue('Afrobeats');
    fireEvent.change(screen.getByLabelText('Taste 1'), {
      target: { value: 'Jazz' },
    });
    expect(screen.getByLabelText('Taste 1')).toHaveValue('Jazz');
    expect(
      vi
        .mocked(requestJson)
        .mock.calls.some(([path]) => path === '/api/resolve'),
    ).toBe(false);
  });
  it('labels fixture discovery, resolves choices and displays an honest trail', async () => {
    render(<Planner />);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: /Build my fictional preview/ }),
    );
    expect(
      await screen.findByRole('region', { name: 'Your outing' }),
    ).toBeVisible();
    expect(
      screen.getByText('Fictional preview — not real Qloo recommendations.'),
    ).toBeVisible();
    expect(screen.getAllByText(/Price not verified/).length).toBeGreaterThan(0);
  });
  it('shows an empty result instead of making up a place', async () => {
    vi.mocked(requestJson).mockImplementation(async (path) =>
      path === '/api/status'
        ? config
        : path === '/api/parse'
          ? { profile, parser: 'rules', model: null, notice: 'Rules' }
          : path === '/api/resolve'
            ? resolved
            : { ...plan, stops: [], alternatives: [] },
    );
    render(<Planner />);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: /Build my fictional preview/ }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No nearby trail to confirm yet.',
      }),
    ).toBeVisible();
  });
  it('displays Qloo failure without silently starting fixture mode', async () => {
    vi.mocked(requestJson).mockImplementation(async (path) => {
      if (path === '/api/status') return config;
      if (path === '/api/parse')
        return { profile, parser: 'rules', model: null, notice: 'Rules' };
      throw new Error('Qloo API key is missing.');
    });
    render(<Planner />);
    await parse();
    fireEvent.click(
      screen.getByRole('button', { name: /Find my Qloo signals/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Qloo API key is missing',
    );
    expect(
      screen.queryByRole('heading', {
        name: 'Confirm the cultural connections.',
      }),
    ).not.toBeInTheDocument();
  });
  it('invalidates old lookups when an extracted taste is revised', async () => {
    render(<Planner />);
    await preview();
    fireEvent.change(screen.getByLabelText('Taste 1'), {
      target: { value: 'Jazz' },
    });
    expect(
      screen.queryByRole('heading', {
        name: 'Confirm the cultural connections.',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Your outing' }),
    ).not.toBeInTheDocument();
  });
  it('can replace a stop with a returned alternative without regenerating preferences', async () => {
    render(<Planner />);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: /Build my fictional preview/ }),
    );
    await screen.findByRole('region', { name: 'Your outing' });
    const alternative = plan.alternatives[0];
    fireEvent.change(screen.getByLabelText('Replace stop 1'), {
      target: { value: alternative.id },
    });
    expect(
      screen.getByRole('heading', { name: alternative.name }),
    ).toBeVisible();
    expect(
      vi
        .mocked(requestJson)
        .mock.calls.filter(([path]) => path === '/api/plan'),
    ).toHaveLength(1);
  });
  it('lets budget changes retain confirmed taste lookups while invalidating an old plan', async () => {
    render(<Planner />);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: /Build my fictional preview/ }),
    );
    await screen.findByRole('region', { name: 'Your outing' });
    fireEvent.change(screen.getByLabelText('Total group budget · USD'), {
      target: { value: '60' },
    });
    expect(
      screen.queryByRole('region', { name: 'Your outing' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Confirm the cultural connections.',
      }),
    ).toBeVisible();
    expect(screen.getByLabelText('Total group budget · USD')).toHaveValue(60);
  });
});
