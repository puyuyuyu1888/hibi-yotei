import { expect, it } from 'vitest';
import { backupFilename, parseBackup, serializeBackup, validateData } from './backup';
import { initialData, saveEntry, setDay } from './model';
function fixture(){return setDay(saveEntry(initialData(),'2026-11-06',{id:'a',time:'23:00',nextDay:false,freeTitle:'朝の',titleId:'title-0',elapsedTitle:'準備'}),'2026-11-06',{title:'通常日',memo:'日本語\n  空白'});}
it('新形式の全データを無加工で往復し、計算結果を重複保存しない',()=>{
  const data=fixture(),json=serializeBackup(data);expect(parseBackup(json)).toEqual(data);expect(JSON.parse(json)).toMatchObject({format:'hibi-timeline-backup',schemaVersion:1,data:{version:2}});
  expect(backupFilename(new Date(2026,10,6,9,5))).toBe('schedule-backup-20261106-0905.json');
});
it.each(['{','[]','null','{"format":"hibi-schedule-backup","schemaVersion":4}','{"format":"hibi-timeline-backup","schemaVersion":99}'])('旧形式や不正JSONを拒否 %s',json=>expect(()=>parseBackup(json)).toThrow());
it.each([
  (d:any)=>{d.version=1;},(d:any)=>{delete d.titles;},(d:any)=>{d.days['2026-02-30']=d.days['2026-11-06'];},
  (d:any)=>{d.days['2026-11-06'].entries[0].time='24:00';},(d:any)=>{d.days['2026-11-06'].entries[0].nextDay='false';},
  (d:any)=>{d.days['2026-11-06'].entries[0].titleId='missing';},(d:any)=>{d.days['2026-11-06'].entries.push({...d.days['2026-11-06'].entries[0],id:'b'});},
  (d:any)=>{d.days['2026-11-06'].entries.push({...d.days['2026-11-06'].entries[0],time:'22:00'});},
  (d:any)=>{d.days['2026-11-06'].entries[0].elapsed=30;},(d:any)=>{delete d.days['2026-11-06'].memo;},
  (d:any)=>{d.titles.push({...d.titles[0],id:'dup'});},(d:any)=>{d.days['2026-11-06'].entries[0].freeTitle='';d.days['2026-11-06'].entries[0].titleId=null;}
])('日付・型・参照・重複・旧項目を検証する',mutate=>{const data=fixture();mutate(data);expect(()=>validateData(data)).toThrow();});
it('翌日の同じHH:MMは重複としない',()=>{const data=fixture();data.days['2026-11-06'].entries.push({...data.days['2026-11-06'].entries[0],id:'b',nextDay:true});expect(validateData(data)).toEqual(data);});
it('機能追加用メモを往復し、項目がない旧データも読み込み、文字列以外は拒否する',()=>{
  const data={...fixture(),featureMemo:'改善案\n  2行目'};expect(parseBackup(serializeBackup(data))).toEqual(data);
  expect(validateData(fixture())).not.toHaveProperty('featureMemo');
  expect(()=>validateData({...fixture(),featureMemo:1})).toThrow();
});
