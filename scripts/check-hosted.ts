import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import type { Page, Response } from 'playwright-core';
import type {
  ParsedProfile,
  Plan,
  PublicConfig,
  ResolvedTaste,
} from '../lib/shared';
import { inSearchArea } from '../lib/server/geography';

// Opt-in live check: one real Gemini extraction and two real Qloo plan builds.
// Provider credentials remain in the hosted app. No key is read by this script.
const origin =
  process.env.TEST_ORIGIN || 'https://tampa-taste-trail.onrender.com';
const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
assert.ok(
  executablePath,
  'Set BROWSER_EXECUTABLE to installed Chrome/Edge/Chromium.',
);
mkdirSync('artifacts/screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const checks: string[] = [];
const errors: string[] = [];
const calls = { parse: 0, resolve: 0, plan: 0 };
async function json<T>(response: Response): Promise<T> {
  assert.equal(response.status(), 200, `API failure: ${await response.text()}`);
  return response.json() as Promise<T>;
}
async function build(page: Page): Promise<Plan> {
  const pending = page.waitForResponse(
    (response) => response.url().endsWith('/api/plan'),
    { timeout: 60000 },
  );
  await page
    .getByRole('button', { name: 'Build my taste trail', exact: false })
    .click();
  const plan = await json<Plan>(await pending);
  await page.getByRole('region', { name: 'Your outing' }).waitFor();
  assert.equal(plan.mode, 'live');
  assert.equal(plan.signals.length, 3);
  assert.ok(
    plan.stops.length > 0,
    'No real suitable stops returned for the test request.',
  );
  assert.equal(plan.budgetStatus, 'not_verified');
  for (const place of [
    ...plan.stops.map((stop) => stop.entity),
    ...plan.alternatives,
  ]) {
    assert.ok(
      inSearchArea(place, plan.profile.area),
      'Out-of-area place survived.',
    );
  }
  assert.equal(
    new Set(plan.stops.map((stop) => stop.entity.id)).size,
    plan.stops.length,
  );
  assert.equal(await page.locator('.stop-card').count(), plan.stops.length);
  return plan;
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    for (const name of ['parse', 'resolve', 'plan'] as const) {
      if (request.url().endsWith(`/api/${name}`)) calls[name]++;
    }
  });
  const loaded = await page.goto(origin, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  assert.equal(loaded?.status(), 200);
  assert.equal(loaded?.headers()['x-content-type-options'], 'nosniff');
  assert.equal(loaded?.headers()['x-frame-options'], 'DENY');
  const status = await context.request.get(`${origin}/api/status`);
  assert.equal(status.status(), 200);
  const config: PublicConfig = await status.json();
  assert.equal(config.qlooAvailable, true);
  assert.equal(config.aiAvailable, true);
  assert.deepEqual(Object.keys(config).sort(), [
    'aiAvailable',
    'aiModel',
    'fixtureAvailable',
    'limits',
    'qlooAvailable',
  ]);
  assert.equal((await context.request.get(`${origin}/healthz`)).status(), 200);
  checks.push(
    'anonymous HTTPS page, health, availability-only status and security headers',
  );

  const prompt =
    'I like Burna Boy, the movie Interstellar, and spicy food. Plan a relaxed evening in Tampa for two people with a total budget of $100.';
  await page
    .getByRole('textbox', { name: /A few things you love/ })
    .fill(prompt);
  const extraction = page.waitForResponse(
    (response) => response.url().endsWith('/api/parse'),
    { timeout: 60000 },
  );
  await page
    .getByRole('button', { name: 'Shape my taste profile', exact: false })
    .click();
  const parsed = await json<ParsedProfile>(await extraction);
  assert.equal(parsed.parser, 'gemini');
  assert.equal(parsed.profile.budgetCents, 10000);
  assert.equal(parsed.profile.priceLevel, null);
  assert.equal(parsed.profile.partySize, 2);
  assert.equal(parsed.profile.interests.length, 3);
  await page.getByRole('region', { name: 'Taste profile' }).waitFor();
  checks.push(
    'real Gemini extraction; $100 group budget does not invent a restaurant tier',
  );

  // Review the editable result as a user would, then verify keyboard navigation.
  for (const [index, term] of [
    'Burna Boy',
    'Interstellar',
    'spicy food',
  ].entries()) {
    assert.equal(
      (
        await page
          .getByLabel(`Taste ${index + 1}`, { exact: true })
          .inputValue()
      ).toLowerCase(),
      term.toLowerCase(),
    );
  }
  await page.getByLabel('Taste 1', { exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .getByLabel('Category for taste 1')
      .evaluate((element) => element === document.activeElement),
    true,
  );
  checks.push('editable extracted tastes and keyboard navigation');

  const resolution = page.waitForResponse(
    (response) => response.url().endsWith('/api/resolve'),
    { timeout: 60000 },
  );
  await page
    .getByRole('button', { name: 'Find my Qloo signals', exact: false })
    .click();
  const resolved = await json<ResolvedTaste>(await resolution);
  assert.equal(resolved.items.length, 3);
  assert.ok(
    resolved.items.every(
      (item) =>
        item.exactId &&
        item.candidates.some((candidate) => candidate.id === item.exactId),
    ),
  );
  await page.getByText(/3 confirmed signals/).waitFor();
  const first = await build(page);
  assert.ok(first.stops.length <= 2);
  assert.equal(
    first.signals.filter((signal) => signal.kind === 'entity').length,
    2,
  );
  assert.equal(
    first.signals.filter((signal) => signal.kind === 'tag').length,
    1,
  );
  checks.push(
    'real Qloo artist/movie/food confirmation, ID revalidation, unique real stops and geography',
  );

  const option = first.alternatives[0];
  assert.ok(option, 'Test request returned no replacement option.');
  await page.getByLabel('Replace stop 1').selectOption(option.id);
  await page
    .locator('.stop-card')
    .first()
    .getByRole('heading', { name: option.name, exact: true })
    .waitFor();
  assert.equal(
    calls.plan,
    1,
    'Replacement should use the same validated pool.',
  );
  await page.getByRole('button', { name: /Copy trail/ }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.includes(option.name));
  assert.ok(copied.includes('Qloo'));
  assert.ok(copied.includes('Prices NOT verified'));
  checks.push(
    'validated-pool stop replacement and clipboard export with source/uncertainty notes',
  );
  await page
    .locator('.trail-section')
    .evaluate((element) =>
      element.scrollIntoView({ behavior: 'instant', block: 'start' }),
    );
  await page.screenshot({
    path: 'artifacts/screenshots/readiness-desktop.png',
  });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.trail-section')
    .evaluate((element) =>
      element.scrollIntoView({ behavior: 'instant', block: 'start' }),
    );
  await page.screenshot({ path: 'artifacts/screenshots/readiness-mobile.png' });
  checks.push('360/390/768/1440px layouts without horizontal overflow');

  await page.getByLabel('Total group budget', { exact: false }).fill('120');
  assert.equal(
    await page.getByRole('region', { name: 'Your outing' }).count(),
    0,
  );
  await page.getByText(/3 confirmed signals/).waitFor();
  await page
    .getByLabel('Search area', { exact: false })
    .selectOption('Ybor City');
  await page.getByLabel('Pace', { exact: false }).selectOption('balanced');
  const changed = await build(page);
  assert.equal(changed.profile.budgetCents, 12000);
  assert.equal(changed.profile.area, 'Ybor City');
  assert.equal(changed.profile.pace, 'balanced');
  assert.ok(changed.stops.length <= 3);
  assert.equal(calls.parse, 1);
  assert.equal(calls.resolve, 1);
  checks.push(
    'budget/area/pace changes invalidate old results and rebuild without another AI extraction',
  );

  // Negative server checks do not submit anything or alter hosted data.
  const headers = { 'X-Taste-Trail': '1', Origin: origin };
  const invalid = await context.request.post(`${origin}/api/resolve`, {
    headers,
    data: { mode: 'live', profile: { ...changed.profile, partySize: 0 } },
  });
  assert.equal(invalid.status(), 400);
  const forged = await context.request.post(`${origin}/api/plan`, {
    headers,
    data: {
      mode: 'live',
      profile: changed.profile,
      selected: [
        { interestIndex: 0, id: '00000000-0000-0000-0000-000000000000' },
      ],
    },
  });
  assert.equal(forged.status(), 400);
  assert.equal((await forged.json()).code, 'UNVERIFIED_SIGNAL');
  const crossOrigin = await context.request.post(`${origin}/api/resolve`, {
    headers: { ...headers, Origin: 'https://invalid.example' },
    data: { profile: changed.profile, mode: 'live' },
  });
  assert.equal(crossOrigin.status(), 403);
  checks.push(
    'live server rejects invalid input, forged signal IDs and cross-origin requests',
  );

  // Explicit browser mocks below test presentation only, not provider behavior.
  await page.route('**/api/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...changed,
        stops: [],
        alternatives: [],
        warnings: ['Browser-test empty result; not a provider response.'],
      }),
    }),
  );
  await page.getByLabel('Total group budget', { exact: false }).fill('125');
  await page
    .getByRole('button', { name: 'Build my taste trail', exact: false })
    .click();
  await page
    .getByRole('heading', { name: 'No nearby trail to confirm yet.' })
    .waitFor();
  assert.equal(await page.locator('.stop-card').count(), 0);
  await page.route('**/api/resolve', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Qloo unavailable — explicit browser-test failure.',
      }),
    }),
  );
  await page.getByLabel('Taste 1', { exact: true }).fill('Jazz');
  await page
    .getByRole('button', { name: 'Find my Qloo signals', exact: false })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Qloo unavailable' })
    .waitFor();
  assert.equal(
    await page.getByRole('region', { name: 'Your outing' }).count(),
    0,
  );
  checks.push(
    'explicitly mocked empty/error states clear stale stops without fictional fallback',
  );
  await page.route('**/api/parse', (route) => {
    if (route.request().postDataJSON().useRules === true)
      return route.continue();
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Gemini unavailable — explicit browser-test failure.',
      }),
    });
  });
  await page
    .getByRole('textbox', { name: /A few things you love/ })
    .fill('Jazz and coffee in Tampa for two under $100.');
  await page
    .getByRole('button', { name: 'Shape my taste profile', exact: false })
    .click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Gemini unavailable' })
    .waitFor();
  const rulesResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/parse'),
  );
  await page
    .getByRole('button', { name: 'Use rule-based extraction', exact: true })
    .click();
  assert.equal(
    (await json<ParsedProfile>(await rulesResponse)).parser,
    'rules',
  );
  await page
    .getByText('Rule-based extraction · not generative AI', { exact: true })
    .waitFor();
  checks.push(
    'explicitly mocked Gemini failure recovers via real, clearly labeled rules only after user choice',
  );
  assert.deepEqual(errors, []);
  const report = {
    origin,
    checkedAt: new Date().toISOString(),
    checks,
    browserErrors: errors,
    live: {
      parser: parsed.parser,
      model: parsed.model,
      confirmedSignals: resolved.items.length,
      firstStopCount: first.stops.length,
      revisedStopCount: changed.stops.length,
    },
    presentationMocks: ['empty plan', 'Qloo failure', 'Gemini failure'],
  };
  writeFileSync(
    'artifacts/hosted-readiness.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
