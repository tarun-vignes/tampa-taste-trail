import { describe, it, expect } from 'vitest';
import { createApi } from '../lib/server/http';
import { readSettings } from '../lib/server/config';
import { profile } from './helpers';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3003/api/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Taste-Trail': '1',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
describe('HTTP boundary', () => {
  it('accepts the browser Host when Next normalizes its internal URL', async () => {
    const api = createApi(readSettings({ ALLOW_FIXTURE_DEMO: 'true' }));
    const response = await api.handle(
      request(
        { profile, mode: 'fixture' },
        {
          Host: '127.0.0.1:3003',
          Origin: 'http://127.0.0.1:3003',
        },
      ),
      'resolve',
    );
    expect(response.status).toBe(200);
    const pinned = createApi(
      readSettings({ APP_ORIGIN: 'https://trail.example' }),
    );
    expect(
      (
        await pinned.handle(
          request(
            { profile, mode: 'fixture' },
            {
              Host: '127.0.0.1:3003',
              Origin: 'http://127.0.0.1:3003',
            },
          ),
          'resolve',
        )
      ).status,
    ).toBe(403);
  });
  it('returns configuration availability without credential values', async () => {
    const response = createApi(
      readSettings({
        QLOO_API_KEY: 'private-qloo',
        GEMINI_API_KEY: 'private-gemini',
      }),
    ).status();
    const text = await response.text();
    expect(text).not.toContain('private-qloo');
    expect(text).not.toContain('private-gemini');
    expect(JSON.parse(text).qlooAvailable).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('reports a missing Qloo credential rather than manufacturing data', async () => {
    const response = await createApi(readSettings({})).handle(
      request({ profile, mode: 'live' }),
      'resolve',
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('QLOO_MISSING');
  });
  it('makes fixture mode an explicit request and enforces its switch', async () => {
    const response = await createApi(
      readSettings({ ALLOW_FIXTURE_DEMO: 'true' }),
    ).handle(request({ profile, mode: 'fixture' }), 'resolve');
    expect(response.status).toBe(200);
    expect((await response.json()).sourceLabel).toContain('Fictional');
    const denied = await createApi(
      readSettings({ ALLOW_FIXTURE_DEMO: 'false' }),
    ).handle(request({ profile, mode: 'fixture' }), 'resolve');
    expect(denied.status).toBe(403);
  });
  it('rejects extra fields, wrong modes and missing preferences', async () => {
    const api = createApi(readSettings({}));
    for (const body of [
      { profile, mode: 'fallback' },
      { profile: { ...profile, interests: [] }, mode: 'live' },
      { profile, mode: 'fixture', apiKey: 'must-not-accept' },
    ])
      expect((await api.handle(request(body), 'resolve')).status).toBe(400);
  });
  it('rejects unexpected origins and missing intent headers', async () => {
    const api = createApi(readSettings({}));
    expect(
      (
        await api.handle(
          request(
            { profile, mode: 'fixture' },
            { Origin: 'https://evil.example' },
          ),
          'resolve',
        )
      ).status,
    ).toBe(403);
    const req = request({ profile, mode: 'fixture' });
    req.headers.delete('X-Taste-Trail');
    expect((await api.handle(req, 'resolve')).status).toBe(403);
  });
  it('bounds actual request bytes and handles invalid JSON', async () => {
    const api = createApi(readSettings({}));
    expect(
      (await api.handle(request({ prompt: 'a'.repeat(17000) }), 'parse'))
        .status,
    ).toBe(413);
    const req = new Request('http://localhost:3003/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Taste-Trail': '1' },
      body: '{',
    });
    expect((await api.handle(req, 'parse')).status).toBe(400);
  });
  it('does not leak unexpected provider details', async () => {
    const api = createApi(readSettings({}), {
      parse: async () => {
        throw new Error('sensitive provider response');
      },
    });
    const response = await api.handle(
      request({ prompt: 'A Tampa evening with jazz' }),
      'parse',
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sensitive');
  });
});
