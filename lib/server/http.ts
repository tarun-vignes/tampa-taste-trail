import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ParsedProfile, PublicConfig } from '../shared';
import { parseTaste } from './ai';
import { TasteAgent } from './agent';
import type { Settings } from './config';
import { ServiceError } from './errors';
import type { DiscoveryPort } from './qloo';

type Action = 'parse' | 'resolve' | 'plan';
type Overrides = {
  qloo?: DiscoveryPort;
  parse?: (value: unknown) => Promise<ParsedProfile>;
};
async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ServiceError(
      415,
      'JSON_REQUIRED',
      'Send an application/json request.',
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ServiceError(
      400,
      'INPUT_REQUIRED',
      'A request body is required.',
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new ServiceError(413, 'TOO_LARGE', 'Keep the request below 16 KB.');
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServiceError(
      400,
      'INVALID_JSON',
      'The request must contain valid JSON.',
    );
  }
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
export function createApi(settings: Settings, overrides: Overrides = {}) {
  const agent = new TasteAgent(settings, overrides.qloo);
  const limits = new Map<string, { start: number; count: number }>();
  return {
    status(): Response {
      const data: PublicConfig = {
        qlooAvailable: !!settings.qlooKey,
        aiAvailable: !!settings.geminiKey && settings.aiProvider === 'gemini',
        aiModel:
          settings.geminiKey && settings.aiProvider === 'gemini'
            ? settings.geminiModel
            : null,
        fixtureAvailable: settings.fixtures,
        limits: { interests: 4, maxStops: 3 },
      };
      return json(data);
    },
    async handle(request: Request, action: Action): Promise<Response> {
      try {
        if (request.headers.get('X-Taste-Trail') !== '1')
          throw new ServiceError(
            403,
            'INTENT_REQUIRED',
            'Use the Taste Trail form to initiate discovery.',
          );
        const origin = request.headers.get('origin');
        const requestUrl = new URL(request.url);
        // Next may normalize the internal URL to localhost. The incoming Host
        // identifies the browser-facing authority; APP_ORIGIN pins deployments.
        const host = request.headers.get('host');
        const allowed =
          settings.origin ||
          (host ? `${requestUrl.protocol}//${host}` : requestUrl.origin);
        if (origin && origin !== allowed)
          throw new ServiceError(
            403,
            'ORIGIN',
            'Cross-origin discovery requests are not allowed.',
          );
        const ip = (request.headers.get('x-forwarded-for') || 'local')
          .split(',')[0]
          .slice(0, 100);
        const key = createHash('sha256').update(ip).digest('hex');
        for (const [id, value] of limits)
          if (Date.now() - value.start > 60000) limits.delete(id);
        const current = limits.get(key) || { start: Date.now(), count: 0 };
        if (++current.count > 18 || limits.size >= 1000)
          throw new ServiceError(
            429,
            'LOCAL_LIMIT',
            'Too many planning requests. Wait a minute and try again.',
          );
        limits.set(key, current);
        const value = await readJson(request);
        if (action === 'parse')
          return json(
            await (overrides.parse
              ? overrides.parse(value)
              : parseTaste(value, settings)),
          );
        if (action === 'resolve') return json(await agent.resolve(value));
        return json(await agent.plan(value));
      } catch (error) {
        if (error instanceof ServiceError)
          return json({ code: error.code, error: error.message }, error.status);
        if (error instanceof z.ZodError)
          return json(
            {
              code: 'INVALID_INPUT',
              error:
                'Check your taste terms, valid date/time, party size, budget, and selected signal IDs. No discovery was substituted.',
            },
            400,
          );
        return json(
          {
            code: 'UNEXPECTED',
            error:
              'Planning could not be completed. Please retry. No venue, price or availability was invented.',
          },
          500,
        );
      }
    },
  };
}
