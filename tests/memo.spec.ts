import { test,expect } from '@playwright/test';
import { add,day,fixture,open,stored,today } from './touch';

test('デバウンス前の再読み込みでも日付・メモ・区間タイトルを復元する',async({page})=>{
  await open(page);await stored(page,fixture());await page.reload();await day(page);
  await page.getByLabel('日付タイトル').fill('変更した日付');await page.getByLabel('メモ').fill('変更したメモ\n  日本語');
  await page.locator('.elapsed-content').click();await page.getByLabel('経過時間タイトル').fill('保存直前の区間');
  await page.reload();await day(page);await expect(page.getByLabel('日付タイトル')).toHaveValue('変更した日付');await expect(page.getByLabel('メモ')).toHaveValue('変更したメモ\n  日本語');await expect(page.locator('.elapsed-content')).toHaveText('保存直前の区間（2時間30分）');
});
test('日付タイトルとメモの自動保存・空欄・日付独立・長文とスクロール',async({page})=>{
  await open(page);await day(page);const memo=page.getByLabel('メモ'),title=page.getByLabel('日付タイトル'),text='  日本語と空白を保持\n'+'長文入力\n'.repeat(200);await expect(memo).toHaveAttribute('rows','3');expect(await memo.getAttribute('placeholder')).toBeNull();expect(await memo.getAttribute('maxlength')).toBeNull();
  await title.fill('通常日');await memo.fill(text);await page.clock.runFor(600);await expect(memo).toHaveValue(text);expect(await memo.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await page.getByRole('button',{name:'カレンダーに戻る'}).click();await day(page,'2026-11-07');await expect(memo).toHaveValue('');await memo.fill('翌日のメモ');await page.getByRole('button',{name:'カレンダーに戻る'}).click();await day(page);await expect(memo).toHaveValue(text);await expect(title).toHaveValue('通常日');
  await memo.fill('');await page.getByRole('button',{name:'カレンダーに戻る'}).click();await page.reload();await day(page);await expect(memo).toHaveValue('');await expect(title).toHaveValue('通常日');expect((await stored(page)).days['2026-11-07'].memo).toBe('翌日のメモ');
});
test('保存容量不足を通知し、入力を保持して再試行できる',async({page})=>{
  await open(page);await day(page);await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value,key){if(fail&&key==='data'){fail=false;throw new DOMException('Full','QuotaExceededError');}return original.call(this,value,key);};});
  await page.getByLabel('メモ').fill('保存する内容');await page.clock.runFor(600);await expect(page.getByRole('alert')).toContainText('容量');await expect(page.getByLabel('メモ')).toHaveValue('保存する内容');await page.getByRole('button',{name:'再試行'}).click();await expect(page.getByRole('alert')).toHaveCount(0);expect((await stored(page)).days[today].memo).toBe('保存する内容');
});
test('現在表示は時刻と区間を区別し、翌日の予定には干渉しない',async({page})=>{
  await open(page);await day(page);await add(page,'23:00','開始');await add(page,'01:00','終了','',true);await page.clock.setSystemTime(new Date('2026-11-06T23:00:00+09:00'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.getByLabel('現在の予定').locator('..')).toHaveClass(/time-row/);
  await page.clock.setSystemTime(new Date('2026-11-06T23:30:00+09:00'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.getByLabel('現在の予定').locator('..')).toHaveClass(/elapsed-row/);
  await page.getByRole('button',{name:'カレンダーに戻る'}).click();await day(page,'2026-11-07');await expect(page.locator('.time-row,.elapsed-row')).toHaveCount(0);await expect(page.getByLabel('現在の予定')).toHaveCount(0);
});
test('全体メモ（featureMemo）はカレンダーの下で自動保存し、再読み込み後も復元する。メニューには「メモ」がない',async({page})=>{
  await open(page);await stored(page,fixture());await page.reload();
  const memo=page.getByRole('textbox',{name:'全体メモ',exact:true});await expect(memo).toHaveValue('');expect(await memo.getAttribute('placeholder')).toBeNull();
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'メモ',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await memo.fill('改善案\n  2行目');await page.clock.runFor(600);expect((await stored(page)).featureMemo).toBe('改善案\n  2行目');
  await page.reload();await expect(memo).toHaveValue('改善案\n  2行目');
  const after=await stored(page);const {featureMemo,...rest}=after;expect(rest).toEqual(fixture());
});
