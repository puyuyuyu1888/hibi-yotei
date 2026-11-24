import { test, expect, type Page } from '@playwright/test';
import { dateKey, parseDate } from '../src/model';
import { fixture, open, stored, swipe, today } from './touch';

async function anchor(page: Page) {
  return page.locator('.date-scroll').evaluate(el => {
    const rows = el.querySelectorAll<HTMLElement>('.ten-day-row'), height = rows[0].getBoundingClientRect().height;
    const row = rows[Math.floor(el.scrollTop / height)];
    return { date: row.dataset.date!, offset: el.scrollTop % height, y: row.getBoundingClientRect().top, height };
  });
}
async function move(page: Page, days: number, pixels = 0) {
  const before = await anchor(page), date = parseDate(before.date); date.setDate(date.getDate() + days);
  const expected = dateKey(date);
  await page.locator('.date-scroll').evaluate((el, amount) => { el.scrollTop += amount; el.dispatchEvent(new Event('scroll')); }, days * before.height + pixels);
  await expect.poll(async () => (await anchor(page)).date).toBe(expected);
  expect((await anchor(page)).offset).toBeCloseTo(before.offset + pixels, 2);
}

test('今日が初期位置・既存の固定列と省略表示・日付タイトルだけ表示・詳細から位置復元', async ({ page }) => {
  await open(page); const data = fixture(); data.days[today].title = '非常に長い日付タイトルを一行に省略して表示'.repeat(3);
  await stored(page, data); await page.reload();
  await expect(page.getByRole('button', { name: /^2026-11-06/ })).toHaveAccessibleName(/予定あり/);
  await expect(page.locator('.weekday-grid')).toHaveText('月火水木金土日');
  await swipe(page, 120); await expect(page.locator('.month-navigation h2')).toContainText('10');
  await page.getByRole('button', { name: '今月' }).click();
  await page.getByRole('button', { name: '予定一覧', exact: true }).click();
  expect((await anchor(page)).date).toBe(today); expect((await anchor(page)).offset).toBe(0);
  await expect(page.locator('h1')).toHaveText('予定一覧');
  await expect(page.locator('.ten-day-list')).not.toContainText(/23:00|夜の|深夜作業|2時間30分|日本語/);
  for (const width of [320, 390, 900]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.ten-day-title').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    const layout = await page.locator(`[data-date="${today}"]`).evaluate(el => {
      const row = el.getBoundingClientRect(), date = el.querySelector('.ten-day-date')!, title = el.querySelector('.ten-day-title')!;
      const style = getComputedStyle(el.querySelector('button')!);
      return { height: row.height, top: row.top, font: style.fontSize, color: style.color, columns: style.gridTemplateColumns, dateY: date.getBoundingClientRect().y, titleY: title.getBoundingClientRect().y, titleX: title.getBoundingClientRect().x - date.getBoundingClientRect().x,
        titleRight: title.getBoundingClientRect().right, rowRight: row.right, background: getComputedStyle(el).backgroundColor, dateColor: getComputedStyle(date).color, dateWeight: getComputedStyle(date).fontWeight };
    });
    // Today's row keeps the row geometry; the title starts after the 今日 badge and stays inside the row.
    expect(layout).toMatchObject({ height: 65, top: 104, font: '14px', color: 'rgb(232, 232, 232)', background: 'rgb(29, 43, 35)', dateColor: 'rgb(102, 187, 138)', dateWeight: '700' });
    expect(layout.titleX).toBe(129); expect(layout.titleRight).toBeLessThanOrEqual(layout.rowRight);
    expect(layout.dateY).toBe(layout.titleY);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: /11月6日/ }).click();
  await page.getByLabel('日付タイトル').fill('変更後'); await page.getByRole('button', { name: '予定一覧に戻る' }).click();
  await expect(page.locator(`[data-date="${today}"] .ten-day-title`)).toHaveText('変更後');
  await move(page, -45, 17); const before = await anchor(page);
  // Pick a fully visible empty date, rather than asking Playwright to scroll an offscreen row.
  const selected = parseDate(before.date); selected.setDate(selected.getDate() + 2); const key = dateKey(selected);
  await page.locator(`[data-date="${key}"] button`).tap();
  await expect(page.locator('.time-row')).toHaveCount(0); await expect(page.getByLabel('メモ')).toBeVisible();
  await page.getByLabel('日付タイトル').fill('過去の日付');
  await page.getByRole('button', { name: '予定一覧に戻る' }).tap();
  const restored = await anchor(page); expect(restored.date).toBe(before.date); expect(restored.y).toBeCloseTo(before.y, 2); expect(restored.offset).toBeCloseTo(before.offset, 2);
  await expect(page.locator(`[data-date="${key}"] .ten-day-title`)).toHaveText('過去の日付');
  const after = await stored(page); expect(after.days[today]).toEqual({ ...data.days[today], title: '変更後' }); expect(after.titles).toEqual(data.titles);
  await page.getByRole('button', { name: 'カレンダーに戻る' }).click();
  await page.getByRole('button', { name: '予定一覧', exact: true }).click(); expect((await anchor(page)).date).toBe(today);
});

test('双方向の連続読み込みで行内位置を保ち、長期間でもDOM・保存データを増やさない', async ({ page }) => {
  await open(page); const data = fixture();
  data.days['2018-02-12'] = { title: '過去の予定', entries: [], memo: '非表示の過去メモ' };
  data.days['2035-08-02'] = { title: '未来の予定', entries: [], memo: '' };
  await stored(page, data); await page.reload();
  await page.getByRole('button', { name: '予定一覧', exact: true }).click();
  // Storage must not be read or written as part of scrolling.
  await page.evaluate(() => { IDBObjectStore.prototype.get = () => { throw new Error('スクロール中の読み直し'); }; IDBObjectStore.prototype.put = () => { throw new Error('スクロール中の保存'); }; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await move(page, 0, 13);
  for (let i = 0; i < 80; i++) {
    await move(page, -40); expect(await page.locator('.ten-day-row').count()).toBe(181);
  }
  expect((await anchor(page)).date).toBe('2018-02-01');
  await expect(page.locator('[data-date="2018-02-12"] .ten-day-title')).toHaveText('過去の予定');
  for (let i = 0; i < 160; i++) await move(page, 40);
  expect((await anchor(page)).date).toBe('2035-08-11');
  await expect(page.locator('[data-date="2035-08-02"] .ten-day-title')).toHaveText('未来の予定');
  expect(await page.locator('.ten-day-row').count()).toBe(181); expect(errors).toEqual([]);
  await page.reload(); expect(await stored(page)).toEqual(data);
});

test('年越し・うるう日・日付変更でスクロール位置を勝手に戻さない', async ({ page }) => {
  await open(page); await page.clock.setSystemTime(new Date('2024-01-01T10:00:00+09:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByRole('button', { name: '予定一覧', exact: true }).click(); expect((await anchor(page)).date).toBe('2024-01-01');
  await move(page, -2); await expect(page.locator('[data-date="2023-12-31"] .ten-day-date')).toHaveText('12月31日（日）');
  await expect(page.locator('[data-date="2024-01-01"] .ten-day-date')).toHaveText('1月1日（月）');
  await expect(page.locator('.ten-day-row.is-today')).toHaveCount(1); await expect(page.locator('.ten-day-row.is-today')).toHaveAttribute('data-date', '2024-01-01');
  await move(page, 60); await expect(page.locator('[data-date="2024-02-29"] .ten-day-date')).toHaveText('2月29日（木）');
  await expect(page.locator('[data-date="2024-03-01"] .ten-day-date')).toHaveText('3月1日（金）');
  const before = await anchor(page); await page.clock.setSystemTime(new Date('2024-01-02T00:00:01+09:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); expect((await anchor(page)).date).toBe(before.date);
  await expect(page.locator('.ten-day-row.is-today')).toHaveAttribute('data-date', '2024-01-02'); await expect(page.locator('.ten-day-row.is-today')).toHaveCount(1);
  await page.getByRole('button', { name: 'カレンダーに戻る' }).click(); await page.getByRole('button', { name: '予定一覧', exact: true }).click();
  expect((await anchor(page)).date).toBe('2024-01-02');
});

test('スマートフォンのタッチスクロールで過去・未来へ移動する', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: '予定一覧', exact: true }).click();
  const session = await page.context().newCDPSession(page);
  const swipe = async (from: number, to: number) => {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: from }] });
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160, y: from + (to - from) * i / 12 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe(650, 200); await expect.poll(async () => (await anchor(page)).date > today).toBe(true);
  // Stop momentum and return near today before swiping in the other direction.
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 350 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('button', { name: 'カレンダーに戻る' }).click(); await page.getByRole('button', { name: '予定一覧', exact: true }).click();
  await swipe(200, 650); await expect.poll(async () => (await anchor(page)).date < today).toBe(true);
  await session.detach();
});
