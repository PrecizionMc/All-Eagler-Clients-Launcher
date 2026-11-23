import { test, expect } from '@playwright/test';
import { catalog } from './fixtures.mjs';

test('instant filters do not make search requests, including on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#download-all')).toBeEnabled();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.locator('#version').selectOption('1.8.8');
  await page.locator('#client-type').selectOption('hacked');
  await page.locator('#search').fill('DRAGON test');
  await expect(page.locator('.client-card')).toHaveCount(1);
  await expect(page.locator('.client-card h3')).toHaveText('Dragon Test');
  await page.locator('#search').fill('not found');
  await expect(page.locator('#empty-state')).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('download all deduplicates, survives reload, and launches offline in another tab', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#download-all')).toBeEnabled();
  const requests = [];
  page.on('request', request => { if (request.url().includes('/fixtures/')) requests.push(request.url()); });
  await page.locator('#download-all').click();
  await expect(page.locator('#notice')).toContainText('Saved 2 unique clients');
  expect(requests).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#saved-count')).toHaveText('2');
  await page.locator('#download-all').click();
  await expect(page.locator('#notice')).toContainText('already saved');
  expect(requests).toHaveLength(2);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#download-all')).toBeEnabled();
  await expect(page.locator('#saved-count')).toHaveText('2');
  const gamePage = await context.newPage();
  await gamePage.goto(`/play.html?id=${catalog.clients[0].id}`);
  await expect(gamePage.locator('h1')).toHaveText('Offline game launched');
  await expect(gamePage).toHaveURL(new RegExp(`/__clients/${catalog.clients[0].id}\\.html$`));
});

test('failed download is visible and retry succeeds without marking failure as saved', async ({ page }) => {
  await page.route('**/fixtures/game.html', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('#download-all')).toBeEnabled();
  await page.locator('#download-all').click();
  await expect(page.locator('#notice')).toContainText('Download failed (503)');
  await expect(page.locator('#saved-count')).toHaveText('0');
  await page.unroute('**/fixtures/game.html');
  await page.locator('#download-all').click();
  await expect(page.locator('#saved-count')).toHaveText('2');
  await page.locator('#saved-tab').click();
  await expect(page.locator('.client-card')).toHaveCount(3);
  await page.locator('.save-button').first().click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  await expect(page.locator('.client-card')).toHaveCount(1);
});

test('single-build Pixel wrappers reveal their canvas without a startup log or screen hook', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#download-all')).toBeEnabled();
  await page.evaluate(async () => {
    const html = `<!doctype html><html><body>
      <script class="client_bundle" type="application/octet-stream">fixture<\/script>
      <div id="selector"><button>1.8.8 (JS)</button></div>
      <div id="launch-container"><span id="detail" class="launch-remove" style="display:block">Loading...</span></div>
      <div id="game_frame" style="opacity:0">Playable game</div>
      <script>
        window.showGame = () => {
          document.getElementById('game_frame').style.opacity = '1';
          document.getElementById('launch-container').remove();
        };
        window.launchVersion = async () => {
          window.launchCount = (window.launchCount || 0) + 1;
          const canvas = document.createElement('canvas');
          document.getElementById('game_frame').appendChild(canvas);
          setTimeout(() => {
            document.getElementById('detail').textContent = 'More boot logs';
          }, 20);
        };
      <\/script></body></html>`;
    const cache = await caches.open('eagler-vault-clients-v1');
    await cache.put(`/__clients/${'d'.repeat(64)}.html`, new Response(html, { headers: { 'Content-Type': 'text/html' } }));
  });
  await context.setOffline(true);
  await page.goto(`/__clients/${'d'.repeat(64)}.html`);
  await expect(page.locator('#game_frame')).toHaveCSS('opacity', '1');
  await expect(page.locator('#detail')).toBeHidden();
  await expect(page.locator('#detail')).toHaveText('More boot logs');
  expect(await page.evaluate(() => window.launchCount)).toBe(1);
});
