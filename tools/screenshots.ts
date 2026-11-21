import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.local/bin/google-chrome',
  args: ['--no-sandbox'],
});
for (const [name, width, height] of [
  ['desktop', 1280, 800],
  ['mobile', 390, 780],
  ['inline', 360, 512],
] as const) {
  await fetch('http://localhost:3001/api/local-reset', { method: 'POST' });
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://localhost:5173/game.html');
  await page
    .getByRole('button', { name: 'Play today’s puzzle', exact: true })
    .waitFor();
  await page.screenshot({
    path: `/home/ubuntu/repos/lumen-shots/${name}-start.png`,
  });
  const previewFits = await page.locator('.preview .board').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.top >= 0 &&
      r.bottom <= innerHeight &&
      r.left >= 0 &&
      r.right <= innerWidth
    );
  });
  expect(previewFits).toBe(true);
  await expect(
    page.getByText('Start your streak', { exact: true })
  ).toBeVisible();
  const init = await (
    await page.request.get('http://localhost:5173/api/init')
  ).json();
  const solution = await (
    await page.request.get('http://localhost:5173/api/local-solution')
  ).json();
  await page
    .getByRole('button', { name: 'Play today’s puzzle', exact: true })
    .click();
  await page.locator('[data-mirror="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForTimeout(1250);
  const different = solution.states
    .map((s: number, i: number) =>
      s !== init.puzzle.mirrors[i].initial ? i : -1
    )
    .filter((i: number) => i >= 0);
  if (different.length > 1)
    await page.locator(`[data-mirror="${different[0]}"]`).click();
  await page.screenshot({
    path: `/home/ubuntu/repos/lumen-shots/${name}-play.png`,
  });
  for (const i of different.slice(different.length > 1 ? 1 : 0))
    await page.locator(`[data-mirror="${i}"]`).click();
  await page.getByRole('button', { name: 'Save your result' }).click();
  await page.getByRole('heading', { name: 'Perfect.' }).waitFor();
  await page.screenshot({
    path: `/home/ubuntu/repos/lumen-shots/${name}-result.png`,
  });
  const fits = await page.locator('.result-card').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });
  expect(fits).toBe(true);
  await expect(
    page.locator('.stats > div').nth(1).locator('strong')
  ).not.toHaveText('00:00');
  console.log(
    name,
    'start/play/result, preview bounds, keyboard, elapsed timer, submit: OK; result fits:',
    fits,
    'console errors:',
    JSON.stringify(errors)
  );
  await context.close();
  // A fresh process is not needed: remove only the local player's saved result for the next viewport.
  await fetch('http://localhost:3001/api/local-reset', { method: 'POST' });
}
await browser.close();
