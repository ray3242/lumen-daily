import { chromium, expect } from '@playwright/test';
const base = 'http://localhost:5173';
const output = '/home/ubuntu/repos/lumen-shots';
const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.local/bin/google-chrome',
  args: ['--no-sandbox'],
});
for (const [name, width, height] of [
  ['portrait', 540, 960],
  ['landscape', 1280, 720],
] as const) {
  await fetch('http://localhost:3001/api/local-reset', { method: 'POST' });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: output, size: { width, height } },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(base + '/game.html');
  const play = page.getByRole('button', {
    name: 'Play today’s puzzle',
    exact: true,
  });
  await play.waitFor();
  const init = await (await page.request.get(base + '/api/init')).json();
  const solution = await (
    await page.request.get(base + '/api/local-solution')
  ).json();
  await page.waitForTimeout(3500);
  await play.click();
  const began = Date.now();
  await expect(
    page.getByText('Tap a mirror to turn it.', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Light all crystals to save' })
  ).toBeDisabled();
  await page.waitForTimeout(2500);
  const changes: number[] = solution.states
    .map((state: number, i: number) =>
      state !== init.puzzle.mirrors[i].initial ? i : -1
    )
    .filter((i: number) => i >= 0);
  for (const i of changes) {
    const mirror = page.locator(`[data-mirror="${i}"]`);
    const rect = await mirror.boundingBox();
    if (!rect) throw new Error('Mirror not visible');
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, {
      steps: 12,
    });
    await mirror.click();
    await page.waitForTimeout(900);
  }
  await expect(
    page.getByText('All crystals lit. Keep this route.', { exact: true })
  ).toBeVisible();
  await page.waitForTimeout(1800);
  const elapsed = Math.floor((Date.now() - began) / 1000);
  await page
    .getByRole('button', { name: 'Save your result', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Perfect.', exact: true }).waitFor();
  const saved = await (await page.request.get(base + '/api/init')).json();
  expect(saved.result.seconds).toBeGreaterThanOrEqual(elapsed - 1);
  expect(saved.result.seconds).toBeLessThanOrEqual(elapsed + 1);
  expect(saved.result.taps).toBe(solution.par);
  const timer = page.locator('.stats > div').nth(1).locator('strong');
  const shown = await timer.innerText();
  expect(shown).not.toBe('00:00');
  await page.waitForTimeout(5000);
  await page
    .getByRole('button', { name: 'Share as a comment', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText(
    'Local preview only — no Reddit action was taken.'
  );
  await page.waitForTimeout(3500);
  const video = page.video();
  await context.close();
  await video?.saveAs(`${output}/demo-${name}.webm`);
  console.log(
    `${name}: real solution, ${changes.length} taps, measured ${elapsed}s, saved ${saved.result.seconds}s, card ${shown}, console errors: ${JSON.stringify(errors)}`
  );
  expect(errors).toEqual([]);
}
await browser.close();
await fetch('http://localhost:3001/api/local-reset', { method: 'POST' });
