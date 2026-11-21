import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:5173';
const output = '/home/ubuntu/repos/lumen-shots';
await fetch(base + '/api/local-reset', { method: 'POST' });
const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.local/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 360, height: 512 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '/game.html');
await page
  .getByRole('button', { name: 'Play today’s puzzle', exact: true })
  .click();
const init = await (await page.request.get(base + '/api/init')).json();
const solution = await (
  await page.request.get(base + '/api/local-solution')
).json();
const changed: number[] = solution.states
  .map((s: number, i: number) =>
    s !== init.puzzle.mirrors[i].initial ? i : -1
  )
  .filter((i: number) => i >= 0);
await page.locator(`[data-mirror="${changed[0]}"]`).click();
await page.waitForTimeout(1250);
const mirrors = () =>
  page
    .locator('[data-mirror] span')
    .evaluateAll((els) => els.map((el) => el.getAttribute('style')));
const mid = await mirrors();
const hud = await page.locator('.hud').innerText();
const elapsed = Number(
  (await page.locator('.time').getAttribute('aria-label'))?.split(' ')[0]
);
await page.reload();
await page.locator('.hud').waitFor();
expect(await page.locator('.hud').innerText()).toBe(hud);
expect(await mirrors()).toEqual(mid);
expect(
  Number(
    (await page.locator('.time').getAttribute('aria-label'))?.split(' ')[0]
  )
).toBeGreaterThanOrEqual(elapsed);
await expect(
  page.getByRole('button', { name: 'Undo', exact: false })
).toBeEnabled();
await page.screenshot({ path: output + '/inline-restored-play.png' });
for (const i of changed.slice(1))
  await page.locator(`[data-mirror="${i}"]`).click();
await expect(
  page.getByRole('button', { name: 'Save your result' })
).toBeEnabled();
expect(
  (await (await page.request.get(base + '/api/init')).json()).result
).toBeNull();
const solved = await mirrors();
await page.reload();
await expect(
  page.getByRole('button', { name: 'Save your result' })
).toBeEnabled();
expect(await mirrors()).toEqual(solved);
await expect(page.locator('.hud')).toContainText(`${solution.par} taps`);
await page.screenshot({ path: output + '/inline-restored-solve.png' });
await page.getByRole('button', { name: 'Save your result' }).click();
await page.getByRole('heading', { name: 'Perfect.', exact: true }).waitFor();
for (const [label, endpoint] of [
  ['Share as a comment', 'share'],
  ['Subscribe to community', 'subscribe'],
  ['Set streak flair', 'flair'],
]) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/' + endpoint) && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: label, exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByRole('status')).toHaveText(
    'Local preview only — no Reddit action was taken.'
  );
  expect(await page.getByRole('status').count()).toBe(1);
  const notice = await page.getByRole('status').boundingBox();
  const actions = await page.locator('.result-actions').boundingBox();
  expect(notice && actions && notice.y + notice.height <= actions.y).toBe(true);
}
await page.screenshot({ path: output + '/inline-share-actions.png' });
await expect(page.getByRole('status')).toHaveCount(0, { timeout: 4500 });
await page.route('**/api/flair', (route) =>
  route.fulfill({ status: 400, json: { error: 'Flair unavailable' } })
);
await page
  .getByRole('button', { name: 'Set streak flair', exact: true })
  .click();
await expect(page.getByRole('status')).toHaveText('Flair unavailable');
await expect(page.getByRole('status')).toHaveCount(0, { timeout: 4500 });
expect(errors).toEqual([]);
console.log(
  '360x512: mid-game state/taps/undo/timer restored; unsaved solve restored; Share → Subscribe → Flair requests succeeded; notices replace and dismiss, including errors; console errors: []'
);
await browser.close();
