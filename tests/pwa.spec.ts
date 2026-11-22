import { test, expect, type Page } from '@playwright/test';
import { serializeBackup } from '../src/backup';
import { appUrl, day, fixture, manage, today } from './touch';

// PWA版（dist/）を playwright.config.ts の webServer で配信して確認する。
const pwaUrl = 'http://127.0.0.1:4173/';
test.use({ offline: false });

async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('manifest・アイコン・Service Worker を読み込み、インストール可能な構成になっている', async ({ page, request }) => {
  await page.goto(pwaUrl);
  await expect(page.getByRole('region', { name: '月間カレンダー' })).toBeVisible();
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, pwaUrl).href)).json();
  expect(manifest).toMatchObject({ name: '日々の予定', display: 'standalone', theme_color: '#335c4b', background_color: '#f7f8f4', start_url: './' });
  expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
  for (const icon of manifest.icons) {
    const response = await request.get(new URL(icon.src, pwaUrl).href);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body(), size = Number(icon.sizes.split('x')[0]);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
  }
  await controlled(page);
  // CSP は外部通信の禁止を維持し、manifest と Service Worker だけを許可する。
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'none'"); expect(csp).toContain("manifest-src 'self'"); expect(csp).toContain("worker-src 'self'");
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys(); const cache = await caches.open(keys[0]);
    return { keys, files: (await cache.keys()).map(r => new URL(r.url).pathname).sort() };
  });
  expect(cached.keys).toHaveLength(1); expect(cached.keys[0]).toMatch(/^hibi-yotei-[0-9a-f]{12}$/);
  expect(cached.files).toEqual(['/', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/index.html', '/manifest.webmanifest']);
});

test('オフラインで再読み込みしても起動し、保存・表示・既存バックアップのインポートができる', async ({ page, context }) => {
  await page.goto(pwaUrl); await controlled(page);
  await context.setOffline(true);
  await page.reload(); await expect(page.getByRole('region', { name: '月間カレンダー' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // 既存形式のバックアップ（featureMemo なし）をインポートする。
  await manage(page);
  await page.getByLabel('バックアップJSON').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(serializeBackup(fixture())) });
  await page.getByRole('button', { name: '置き換えて復元' }).click();
  await expect(page.getByRole('region', { name: '月間カレンダー' })).toBeVisible();
  await day(page, today);
  await expect(page.getByLabel('日付タイトル')).toHaveValue('通常日');
  await expect(page.locator('.entry-time')).toHaveText(['23:00', '翌01:30']);
  await page.getByLabel('日付タイトル').fill('オフラインで変更'); await page.getByLabel('メモ').fill('オフラインのメモ');
  await page.getByRole('button', { name: 'カレンダーに戻る' }).click();
  await page.reload(); await day(page, today);
  await expect(page.getByLabel('日付タイトル')).toHaveValue('オフラインで変更');
  await expect(page.getByLabel('メモ')).toHaveValue('オフラインのメモ');
  await expect(page.locator('.elapsed-row')).toHaveText('深夜作業（2時間30分）');
});

test('新しい版の Service Worker は古い版のキャッシュを削除し、ほかのアプリのキャッシュは残す', async ({ page }) => {
  await page.goto(pwaUrl); await controlled(page);
  const current = await page.evaluate(() => caches.keys());
  await page.evaluate(async () => {
    await (await caches.open('hibi-yotei-000000000000')).put('/old', new Response('old'));
    await (await caches.open('other-app')).put('/other', new Response('other'));
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  });
  await page.reload(); await controlled(page);
  expect((await page.evaluate(() => caches.keys())).sort()).toEqual([...current, 'other-app'].sort());
});

test('単一HTML版はファイルを直接開いて動き、manifest も Service Worker も使わない', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T10:00:00+09:00') });
  await page.goto(appUrl); await expect(page.getByRole('region', { name: '月間カレンダー' })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  // file:// では Service Worker を登録できない。制御されていないことを確認する。
  expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
});
