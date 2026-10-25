import { z } from 'zod';
export type Settings = {
  qlooKey: string;
  qlooBase: string;
  geminiKey: string;
  geminiModel: string;
  aiProvider: 'gemini' | 'rules';
  fixtures: boolean;
  origin: string | null;
};
export function readSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Settings {
  const base = new URL(env.QLOO_BASE_URL || 'https://api.qloo.com');
  // Only Qloo-controlled HTTPS origins may receive the API credential. The event
  // host must still match the issuer's instructions; never probe another host.
  if (
    base.protocol !== 'https:' ||
    !(
      base.hostname === 'api.qloo.com' ||
      base.hostname.endsWith('.api.qloo.com')
    ) ||
    base.username ||
    base.password ||
    base.port ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw new Error(
      'QLOO_BASE_URL must be a Qloo API HTTPS origin authorized by your key issuer.',
    );
  const origin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || null;
  if (origin) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (!['localhost', '127.0.0.1'].includes(url.hostname) &&
        url.protocol !== 'https:')
    )
      throw new Error(
        'APP_ORIGIN must be an HTTPS origin, or local HTTP, without a path.',
      );
  }
  return {
    qlooKey: env.QLOO_API_KEY || '',
    qlooBase: base.origin,
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .parse(env.GEMINI_MODEL || 'gemini-3.1-flash-lite'),
    aiProvider: z.enum(['gemini', 'rules']).parse(env.AI_PROVIDER || 'gemini'),
    fixtures:
      env.ALLOW_FIXTURE_DEMO === 'true' ||
      (!env.ALLOW_FIXTURE_DEMO && env.NODE_ENV !== 'production'),
    origin,
  };
}
