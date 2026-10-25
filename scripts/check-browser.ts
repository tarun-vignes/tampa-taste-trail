import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
if (!executablePath)
  throw new Error(
    'Set BROWSER_EXECUTABLE to an installed Chrome/Edge/Chromium binary.',
  );
mkdirSync('artifacts/screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Explicit rules + fixture tests: this script never spends AI or Qloo quota.
  await page.route('**/api/parse', (route) =>
    route.continue({
      postData: JSON.stringify({
        ...route.request().postDataJSON(),
        useRules: true,
      }),
    }),
  );
  const response = await page.goto(
    process.env.TEST_ORIGIN || 'http://127.0.0.1:3003',
  );
  assert.equal(response?.status(), 200);
  const extract = page.getByRole('button', {
    name: 'Shape my taste profile',
    exact: false,
  });
  await extract.waitFor();
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>('button.full')?.disabled,
  );
  await page.screenshot({ path: 'artifacts/screenshots/01-welcome.png' });
  await extract.click();
  await page.getByRole('region', { name: 'Taste profile' }).waitFor();
  await page
    .getByRole('button', { name: 'Explore fictional preview', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Confirm the cultural connections.' })
    .waitFor();
  await page
    .getByRole('button', { name: 'Build my fictional preview', exact: false })
    .click();
  await page.getByRole('region', { name: 'Your outing' }).waitFor();
  await page
    .getByText('Fictional preview — not real Qloo recommendations.', {
      exact: true,
    })
    .waitFor();
  const replace = page.getByLabel('Replace stop 1');
  const option = await replace.locator('option').nth(1).getAttribute('value');
  assert.ok(option);
  await replace.selectOption(option);
  await page
    .locator('.trail-section')
    .evaluate((el) =>
      el.scrollIntoView({ block: 'start', behavior: 'instant' }),
    );
  await page.screenshot({ path: 'artifacts/screenshots/02-fixture-trail.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    'Mobile horizontal overflow',
  );
  await page.screenshot({ path: 'artifacts/screenshots/03-mobile.png' });
  await page.getByLabel('Taste 1', { exact: true }).fill('Jazz');
  assert.equal(
    await page.getByRole('region', { name: 'Your outing' }).count(),
    0,
  );
  await page.route('**/api/resolve', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Qloo unavailable — explicit browser test fixture.',
      }),
    }),
  );
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
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real Chrome desktop/mobile; editable extraction; explicit fixture discovery; signal confirmation; trail; alternative swap; revised preferences; API-error state; no horizontal overflow or browser runtime errors. No Qloo/AI calls used.',
  );
} finally {
  await browser.close();
}
