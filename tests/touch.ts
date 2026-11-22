import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { initialData, saveEntry, setDay, setElapsedTitle, type Data } from '../src/model';
export const appUrl=pathToFileURL(path.resolve('index.html')).href;
export const today='2026-11-06';
export async function open(page:Page){await page.clock.install({time:new Date('2026-11-06T10:00:00+09:00')});await page.goto(appUrl);await expect(page.getByRole('region',{name:'月間カレンダー'})).toBeVisible();}
export async function day(page:Page,key=today){await page.getByRole('button',{name:new RegExp(`^${key}`)}).click();}
export async function add(page:Page,time:string,free:string,selected='',next=false,expectSaved=true){await page.getByRole('button',{name:'時刻を追加',exact:true}).click();await page.getByLabel('時刻',{exact:true}).fill(time);await page.getByLabel('自由入力タイトル').fill(free);if(selected)await page.getByLabel('タイトル選択',{exact:true}).selectOption(selected);if(next)await page.getByRole('checkbox',{name:'翌日'}).check();await page.getByRole('button',{name:'決定',exact:true}).click();if(expectSaved)await expect(page.getByRole('dialog',{name:'新規時刻入力',exact:true})).toHaveCount(0);}
export async function manage(page:Page,name='データ管理'){await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();}
export function fixture():Data{
  let data=saveEntry(initialData(),today,{id:'a',time:'23:00',nextDay:false,freeTitle:'夜の',titleId:'title-2',elapsedTitle:'深夜作業'});
  data=saveEntry(data,today,{id:'b',time:'01:30',nextDay:true,freeTitle:'終了',titleId:null,elapsedTitle:''});
  data=setElapsedTitle(data,today,'a','深夜作業');data=setDay(data,today,{title:'通常日',memo:'日本語\n  空白を維持\n'});data.titles.reverse();return data;
}
export async function stored(page:Page,replacement?:Data){return page.evaluate(async replacement=>{const request=indexedDB.open(`hibi-timeline-v2:file:${location.pathname}`,1);const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await new Promise<Data>((resolve,reject)=>{const tx=db.transaction('app',replacement?'readwrite':'readonly'),store=tx.objectStore('app');if(replacement)store.put(replacement,'data');const read=store.get('data');tx.oncomplete=()=>resolve(read.result);tx.onabort=()=>reject(tx.error);});}finally{db.close();}},replacement);}
export async function exported(page:Page,file:string){const download=page.waitForEvent('download');await page.getByRole('button',{name:'エクスポート',exact:true}).click();const result=await download;expect(result.suggestedFilename()).toMatch(/^schedule-backup-\d{8}-\d{4}\.json$/);await result.saveAs(file);return JSON.parse(await readFile(file,'utf8'));}
export async function drag(page:Page,from:number,to:number){
  const handles=page.getByRole('button',{name:/を並べ替え$/}),a=(await handles.nth(from).boundingBox())!,b=(await handles.nth(to).boundingBox())!,session=await page.context().newCDPSession(page),x=a.x+20,startY=a.y+20,endY=b.y+20;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]});for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY+(endY-startY)*i/8}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
}
