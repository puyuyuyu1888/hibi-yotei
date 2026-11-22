import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { initialData, saveEntry, setDay } from './model';
import { loadData, openAppDatabase, openDatabase, persistData, replaceData } from './storage';
const databases: IDBDatabase[]=[];
const open=async()=>{const db=await openDatabase(crypto.randomUUID());databases.push(db);return db;};
afterEach(()=>{databases.splice(0).forEach(db=>db.close());vi.unstubAllGlobals();localStorage.clear();});
it('新規データと全項目を再接続して保存・復元する',async()=>{
  const db=await open(); expect(await loadData(db)).toEqual(initialData());
  const data=setDay(saveEntry(initialData(),'2026-11-06',{id:'a',time:'01:00',nextDay:true,freeTitle:'朝の',titleId:'title-1',elapsedTitle:'準備'}),'2026-11-06',{title:'通常日',memo:'日本語\n  空白'});
  data.titles.reverse();await persistData(db,data);const name=db.name;db.close();const again=await openDatabase(name);databases.push(again);expect(await loadData(again)).toEqual(data);
});
it('インポートは検証後に一括置換し、保存データを読み直す',async()=>{
  const db=await open(),before=setDay(initialData(),'2026-11-06',{title:'以前'}),after=setDay(initialData(),'2026-11-07',{title:'置換'});
  await persistData(db,before);expect(await replaceData(db,after)).toEqual(after);expect(await loadData(db)).toEqual(after);
  await expect(replaceData(db,{...after,version:1} as any)).rejects.toThrow();expect(await loadData(db)).toEqual(after);
});
it('トランザクション途中の失敗では既存データを失わない',async()=>{
  const db=await open(),before=setDay(initialData(),'2026-11-06',{memo:'保持'});await persistData(db,before);
  const original=IDBObjectStore.prototype.put;let fail=true;
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){if(fail&&key==='data'){fail=false;throw new DOMException('Full','QuotaExceededError');}return original.call(this,value,key);});
  await expect(replaceData(db,initialData())).rejects.toThrow();spy.mockRestore();expect(await loadData(db)).toEqual(before);
});
it('未完了のインポート回復情報から元のデータを復元する',async()=>{
  const db=await open(),before=setDay(initialData(),'2026-11-06',{title:'元の内容'});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('app','readwrite'),store=tx.objectStore('app');store.put({hadData:true,previous:before},'import-recovery');store.put(initialData(),'data');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
  expect(await loadData(db)).toEqual(before);
});
it('旧データの保存領域を一切変更しない',async()=>{
  const old=await openDatabase('hibi-schedule');databases.push(old);
  await new Promise<void>(resolve=>{const tx=old.transaction('app','readwrite');tx.objectStore('app').put({legacy:true},'data');tx.oncomplete=()=>resolve();});
  const current=await openAppDatabase({protocol:'file:',pathname:'/new.html'});if(!('mode'in current))databases.push(current);
  expect(await loadData(current)).toEqual(initialData());
  expect(await new Promise(resolve=>{const tx=old.transaction('app','readonly'),r=tx.objectStore('app').get('data');tx.oncomplete=()=>resolve(r.result);})).toEqual({legacy:true});
});
it('IndexedDB不可のfile/content/httpsではlocalStorageを使用する',async()=>{
  vi.stubGlobal('indexedDB',undefined);
  for(const protocol of ['file:','content:','https:']){const db=await openAppDatabase({protocol,pathname:'/app.html'});expect('mode'in db&&db.mode).toBe('local');await persistData(db,setDay(initialData(),'2026-11-06',{title:protocol}));expect((await loadData(db)).days['2026-11-06'].title).toBe(protocol);expect(await replaceData(db,initialData())).toEqual(initialData());}
});
it('代替保存の容量不足は既存データを保持し、両方不可なら保存不可',async()=>{
  vi.stubGlobal('indexedDB',undefined);const db=await openAppDatabase({protocol:'file:',pathname:'/app.html'});await persistData(db,initialData());
  const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});await expect(replaceData(db,setDay(initialData(),'2026-11-06',{title:'失敗'}))).rejects.toThrow();spy.mockRestore();expect(await loadData(db)).toEqual(initialData());
  vi.stubGlobal('localStorage',undefined);const none=await openAppDatabase();expect('mode'in none&&none.mode).toBe('memory');await expect(persistData(none,initialData())).rejects.toThrow();
});
it('壊れた保存データを初期値で上書きしない',async()=>{
  vi.stubGlobal('indexedDB',undefined);const db=await openAppDatabase();if(!('mode'in db)||db.mode!=='local')throw Error();db.storage.setItem(db.key,'{bad');await expect(loadData(db)).rejects.toThrow();expect(db.storage.getItem(db.key)).toBe('{bad');
});
