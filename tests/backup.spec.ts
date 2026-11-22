import { test,expect } from '@playwright/test';
import { copyFile,readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serializeBackup } from '../src/backup';
import { appUrl,day,exported,fixture,manage,open,stored,today } from './touch';
test('全データの新形式出力と別HTMLへの復元、オフライン・外部依存なし',async({page,context},info)=>{
  const requests:string[]=[];context.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await open(page);const data=fixture();await stored(page,data);await page.reload();await manage(page);const backup=await exported(page,info.outputPath('backup.json'));expect(backup.data).toEqual(data);expect(backup).toMatchObject({format:'hibi-timeline-backup',schemaVersion:1,data:{version:2}});
  const html=await readFile('index.html','utf8');expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);expect(html).not.toMatch(/<link\b[^>]*\brel=["'](?:stylesheet|manifest|modulepreload)/i);
  const target=info.outputPath('updated.html');await copyFile('index.html',target);await page.goto(pathToFileURL(target).href);await manage(page);await page.getByLabel('バックアップJSON').setInputFiles(info.outputPath('backup.json'));await expect(page.getByRole('dialog')).toContainText('すべて削除');await page.getByRole('button',{name:'置き換えて復元'}).click();await day(page);await expect(page.getByLabel('日付タイトル')).toHaveValue('通常日');await expect(page.getByLabel('メモ')).toHaveValue(data.days[today].memo);await expect(page.locator('.entry-time')).toHaveText(['23:00','翌01:30']);await expect(page.locator('.elapsed-row')).toHaveText('深夜作業（2時間30分）');expect(await stored(page)).toEqual(data);expect(requests).toEqual([]);
});
test('不正JSON・旧形式・重複・キャンセル・保存途中失敗で既存データを変えない',async({page})=>{
  await open(page);const data=fixture();await stored(page,data);await page.reload();await manage(page);
  const valid=JSON.parse(serializeBackup(data)),duplicate=structuredClone(valid);duplicate.data.days[today].entries.push({...duplicate.data.days[today].entries[0],id:'dup'});
  for(const source of ['{bad',JSON.stringify({...valid,format:'hibi-schedule-backup'}),JSON.stringify(duplicate)]){await page.getByLabel('バックアップJSON').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(source)});await expect(page.getByRole('alert')).toBeVisible();expect(await stored(page)).toEqual(data);}
  await page.getByLabel('バックアップJSON').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});await page.getByRole('dialog').getByRole('button',{name:'キャンセル'}).click();expect(await stored(page)).toEqual(data);
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value,key){if(fail&&key==='data'){fail=false;throw new DOMException('Full','QuotaExceededError');}return original.call(this,value,key);};});
  await page.getByLabel('バックアップJSON').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});await page.getByRole('button',{name:'置き換えて復元'}).click();await expect(page.getByRole('alert')).toContainText('復元に失敗');expect(await stored(page)).toEqual(data);await page.reload();expect(await stored(page)).toEqual(data);
});
for(const local of [false,true])test(`再起動で全データを保持する（${local?'localStorage':'IndexedDB'}）`,async({browser},info)=>{
  const profile=info.outputPath('profile'),browserType=browser.browserType();
  const launch=async()=>{const context=await browserType.launchPersistentContext(profile,{headless:true,offline:true,viewport:{width:320,height:740},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo',downloadsPath:info.outputPath('downloads'),args:['--disable-breakpad','--disable-crash-reporter',`--crash-dumps-dir=${info.outputPath('crashes')}`]});if(local)await context.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));return context;};
  let context=await launch(),page=context.pages()[0];await page.goto(appUrl);await manage(page);await page.getByLabel('バックアップJSON').setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from(serializeBackup(fixture()))});await page.getByRole('button',{name:'置き換えて復元'}).click();await context.close();
  context=await launch();page=context.pages()[0];await page.goto(appUrl);await manage(page);expect((await exported(page,info.outputPath('after-restart.json'))).data).toEqual(fixture());await context.close();
});
