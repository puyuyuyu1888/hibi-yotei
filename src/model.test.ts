import { describe, expect, it } from 'vitest';
import { absoluteTime, activeOptions, calendarDays, clearEntries, displayTitle, initialData, normalizeTime, orderOptions, removeEntry, removeOption, saveEntry, saveOption, setDay, setElapsedTitle, sortedEntries, tenDayDates, validDate, type Entry } from './model';
const entry = (id: string, time: string, nextDay = false): Entry => ({ id, time, nextDay, freeTitle: '', titleId: 'title-0', elapsedTitle: '' });
describe('時刻・タイトルと自動配置', () => {
  it('自由入力・選択・両方を別々に保存し、空白を挿入しない', () => {
    let data = initialData(); data = saveEntry(data, '2026-11-06', { ...entry('a','8:00'), freeTitle: '朝の' });
    expect(data.days['2026-11-06'].entries[0].time).toBe('08:00');
    expect(displayTitle(data.days['2026-11-06'].entries[0], data.titles)).toBe('朝の起床');
    data = saveEntry(data, '2026-11-06', { ...entry('b','09:00'), titleId: null, freeTitle: '外出' });
    expect(displayTitle(data.days['2026-11-06'].entries[1], data.titles)).toBe('外出');
    expect(() => saveEntry(data, '2026-11-06', { ...entry('c','10:00'), titleId: null })).toThrow('タイトル');
  });
  it('入力順を保存したまま、当日→翌日の時刻順を生成する', () => {
    const entries = [entry('c','01:00',true), entry('b','23:00'), entry('a','08:00')], before = JSON.stringify(entries);
    expect(sortedEntries(entries).map(e=>e.id)).toEqual(['a','b','c']); expect(JSON.stringify(entries)).toBe(before);
    expect(absoluteTime(entries[0])).toBe(1500);
  });
  it('追加・編集で絶対時刻の重複を拒否し、元データを維持する', () => {
    let data = saveEntry(initialData(), '2026-11-06', entry('a','09:00'));
    expect(() => saveEntry(data, '2026-11-06', entry('b','09:00'))).toThrow('同じ時刻');
    data = saveEntry(data, '2026-11-06', entry('b','09:00',true)); const before = JSON.stringify(data);
    expect(() => saveEntry(data, '2026-11-06', entry('b','09:00'))).toThrow(); expect(JSON.stringify(data)).toBe(before);
  });
  it.each(['24:00','12:60','-1:00','12:2','NaN',''])('不正な時刻 %s', value => expect(()=>normalizeTime(value)).toThrow());
  it('候補の追加・改名・削除・順序を維持する', () => {
    let data = saveEntry(initialData(), '2026-11-06', entry('a','09:00'));
    data = saveOption(data, { id: 'title-0', name: '起きる' }); expect(displayTitle(data.days['2026-11-06'].entries[0],data.titles)).toBe('起きる');
    expect(()=>saveOption(data,{id:'dup',name:'起きる'})).toThrow();
    data = removeOption(data,'title-0'); expect(activeOptions(data).some(o=>o.id==='title-0')).toBe(false);
    expect(displayTitle(data.days['2026-11-06'].entries[0],data.titles)).toBe('起きる');
    data = orderOptions(data,activeOptions(data).reverse()); expect(data.titles.at(-1)?.deleted).toBe(true);
  });
});
it('分割・統合・時刻編集で開始IDに経過時間タイトルを保持し、最後になっても消さない', () => {
  let data = saveEntry(initialData(),'2026-11-06',entry('a','08:00'));
  data = saveEntry(data,'2026-11-06',entry('c','09:00'));
  data = setElapsedTitle(data,'2026-11-06','a','準備');
  data = saveEntry(data,'2026-11-06',entry('b','08:30')); expect(data.days['2026-11-06'].entries.find(e=>e.id==='b')?.elapsedTitle).toBe('');
  data = removeEntry(data,'2026-11-06','b'); expect(data.days['2026-11-06'].entries[0].elapsedTitle).toBe('準備');
  data = saveEntry(data,'2026-11-06',entry('a','10:00')); expect(sortedEntries(data.days['2026-11-06'].entries).at(-1)?.elapsedTitle).toBe('準備');
  data = setDay(data,'2026-11-07',{memo:'別日'}); expect(data.days['2026-11-07'].entries).toEqual([]);
});
it('月曜始まりとローカル10日間、実在する日付を扱う', () => {
  expect(calendarDays(2026,10)[0].getDay()).toBe(1); expect(tenDayDates(new Date(2026,11,28))).toHaveLength(10);
  expect(validDate('2024-02-29')).toBe(true); expect(validDate('2026-02-29')).toBe(false); expect(validDate('2026-13-01')).toBe(false);
});
describe('その日の時刻の全削除', () => {
  it('時刻・翌日指定・経過時間タイトルだけを消し、日付タイトル・メモ・他の日・候補・機能追加用メモは変えない', () => {
    let data = initialData();
    data = saveEntry(data, '2026-11-22', { ...entry('a', '08:00'), elapsedTitle: '準備' });
    data = saveEntry(data, '2026-11-22', { ...entry('b', '01:00', true), freeTitle: '深夜' });
    data = setDay(data, '2026-11-22', { title: '日付タイトル', memo: 'メモ\n2行目' });
    data = saveEntry(data, '2026-11-23', entry('c', '09:00'));
    data = { ...data, featureMemo: '改善案' };
    const before = JSON.stringify(data), cleared = clearEntries(data, '2026-11-22');
    expect(cleared.days['2026-11-22']).toEqual({ title: '日付タイトル', memo: 'メモ\n2行目', entries: [] });
    expect(cleared.days['2026-11-23']).toBe(data.days['2026-11-23']);
    expect(cleared.titles).toBe(data.titles); expect(cleared.featureMemo).toBe('改善案'); expect(cleared.version).toBe(2);
    expect(JSON.stringify(data)).toBe(before);
  });
});
