import { afterEach, expect, it, vi } from 'vitest';
import { Autosave } from './autosave';
import { initialData, setDay } from './model';
afterEach(()=>{vi.useRealTimers();localStorage.clear();});
it('タイトル・メモ・区間編集をデバウンスし、最新内容を一緒に保存する',async()=>{
  vi.useFakeTimers();const save=vi.fn().mockResolvedValue(undefined),saver=new Autosave({save,key:'draft',onError:vi.fn()});saver.initialize(initialData());
  saver.update(setDay(saver.data!,'2026-11-06',{title:'日付'}));saver.update(setDay(saver.data!,'2026-11-06',{memo:'日本語\n  空白'}));expect(save).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(500);expect(save).toHaveBeenCalledTimes(1);expect(save.mock.calls[0][0].days['2026-11-06']).toMatchObject({title:'日付',memo:'日本語\n  空白'});
});
it('古い保存が遅れても新しい保存を上書きしない',async()=>{
  let release!:()=>void;const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{release=r;})).mockResolvedValue(undefined);
  const saver=new Autosave({save,key:'draft',onError:vi.fn()});saver.initialize(initialData());saver.update(setDay(saver.data!,'2026-11-06',{title:'古い'}));const first=saver.flush();await Promise.resolve();await Promise.resolve();
  saver.update(setDay(saver.data!,'2026-11-06',{title:'最新'}));const last=saver.flush();expect(save).toHaveBeenCalledTimes(1);release();await first;await last;expect(save.mock.calls[1][0].days['2026-11-06'].title).toBe('最新');
});
it('保存失敗でも入力を保持して再試行する',async()=>{
  const error=vi.fn(),save=vi.fn().mockRejectedValueOnce(Error('quota')).mockResolvedValue(undefined),saver=new Autosave({save,key:'draft',onError:error});saver.initialize(initialData());saver.update(setDay(saver.data!,'2026-11-06',{memo:'保持'}));await expect(saver.flush()).rejects.toThrow();expect(saver.data!.days['2026-11-06'].memo).toBe('保持');await saver.flush();expect(error).toHaveBeenCalledTimes(1);
});
it('離脱前の未保存入力を同期退避し、再起動時に回復する',()=>{
  const saver=new Autosave({save:()=>new Promise(()=>{}),key:'draft',onError:vi.fn()}),original=initialData();saver.initialize(original);saver.update(setDay(original,'2026-11-06',{memo:'未保存'}));saver.leave();saver.stop();
  const next=new Autosave({save:vi.fn(),key:'draft',onError:vi.fn()});expect(next.initialize(original).days['2026-11-06'].memo).toBe('未保存');next.stop();
});
it('古い回復情報で別の新しい保存内容を上書きしない',()=>{
  const saved=initialData(),draft=setDay(saved,'2026-11-06',{memo:'古い退避'});localStorage.setItem('draft',JSON.stringify({version:1,base:JSON.stringify(saved),candidates:[],data:draft}));
  const fresh=setDay(saved,'2026-11-06',{memo:'最新'}),saver=new Autosave({save:vi.fn(),key:'draft',onError:vi.fn()});expect(saver.initialize(fresh)).toEqual(fresh);
});
it('インポート前に保存を完了し、回復情報を除去する',async()=>{
  const saver=new Autosave({save:vi.fn().mockResolvedValue(undefined),key:'draft',onError:vi.fn()});saver.initialize(initialData());saver.update(setDay(saver.data!,'2026-11-06',{title:'前'}));await saver.prepareImport();const replacement=initialData();saver.acceptSaved(replacement);expect(saver.data).toEqual(replacement);expect(localStorage.getItem('draft')).toBeNull();
});
