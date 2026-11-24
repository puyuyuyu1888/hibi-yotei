export type Option = { id: string; name: string; deleted?: true };
export type Entry = { id: string; time: string; nextDay: boolean; freeTitle: string; titleId: string | null; elapsedTitle: string };
export type Day = { title: string; memo: string; entries: Entry[] };
// プリセットは時刻の予定だけを持つ（日付タイトル・メモ・画像は含めない）。
export type PresetEntry = Omit<Entry, 'id'>;
export type Preset = { id: string; name: string; entries: PresetEntry[] };
export type Data = { version: 2; titles: Option[]; days: Record<string, Day>; featureMemo?: string; presets?: Preset[] };
let sequence = 0;
export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
  return `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`;
}
export const emptyDay = (): Day => ({ title: '', memo: '', entries: [] });
export const initialData = (): Data => ({ version: 2, titles: ['起床', '準備', '作業', '休憩', '食事', '移動', '就寝'].map((name, i) => ({ id: `title-${i}`, name })), days: {} });
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const result = new Date(2000, m - 1, d, 12); result.setFullYear(y); return result;
}
export function validDate(key: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number(key.slice(0, 4)) > 0 && dateKey(parseDate(key)) === key; }
export function normalizeTime(time: string): string {
  if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('時刻を正しく入力してください。');
  return time.padStart(5, '0');
}
export function minutes(time: string): number { const [hour, minute] = normalizeTime(time).split(':').map(Number); return hour * 60 + minute; }
export function absoluteTime(entry: Pick<Entry, 'time' | 'nextDay'>): number { return minutes(entry.time) + (entry.nextDay ? 1440 : 0); }
export function sortedEntries(entries: readonly Entry[]): Entry[] { return [...entries].sort((a, b) => absoluteTime(a) - absoluteTime(b)); }
export function displayTitle(entry: Entry, titles: readonly Option[]): string { return entry.freeTitle + (titles.find(t => t.id === entry.titleId)?.name ?? ''); }
export function calendarDays(year: number, month: number): Date[] {
  const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - offset + i, 12));
}
export function tenDayDates(today: Date): Date[] { return Array.from({ length: 10 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12)); }
export function setDay(data: Data, key: string, patch: Partial<Day>): Data {
  if (!validDate(key)) throw new Error('日付が不正です。');
  return { ...data, days: { ...data.days, [key]: { ...(data.days[key] ?? emptyDay()), ...patch } } };
}
export function saveEntry(data: Data, date: string, draft: Entry): Data {
  const entries = data.days[date]?.entries ?? [], existing = entries.find(e => e.id === draft.id);
  if (!draft.id.trim() || Object.entries(data.days).some(([key, day]) => key !== date && day.entries.some(e => e.id === draft.id))) throw new Error('時刻IDが不正です。');
  const entry = { ...draft, time: normalizeTime(draft.time) };
  if (typeof entry.nextDay !== 'boolean') throw new Error('翌日の指定が不正です。');
  if (typeof entry.freeTitle !== 'string' || /[\r\n]/.test(entry.freeTitle)) throw new Error('タイトルを1行で入力してください。');
  const option = data.titles.find(t => t.id === entry.titleId);
  if (entry.titleId !== null && (!option || option.deleted && existing?.titleId !== option.id)) throw new Error('タイトル候補を選び直してください。');
  if (!entry.freeTitle.trim() && !option) throw new Error('タイトルを入力または選択してください。');
  if (entries.some(e => e.id !== entry.id && absoluteTime(e) === absoluteTime(entry))) throw new Error('同じ時刻が登録されています。');
  // Keep an interval title on its starting record even when that record becomes last.
  const saved = { ...entry, elapsedTitle: existing?.elapsedTitle ?? '' };
  return setDay(data, date, { entries: existing ? entries.map(e => e.id === saved.id ? saved : e) : [...entries, saved] });
}
export function removeEntry(data: Data, date: string, id: string): Data { return setDay(data, date, { entries: (data.days[date]?.entries ?? []).filter(e => e.id !== id) }); }
// その日の時刻をすべて削除する（翌日指定・経過時間タイトルを含む）。日付タイトルとメモは残す。
export function clearEntries(data: Data, date: string): Data { return setDay(data, date, { entries: [] }); }
export function setElapsedTitle(data: Data, date: string, id: string, elapsedTitle: string): Data {
  if (/[\r\n]/.test(elapsedTitle)) throw new Error('区間タイトルを1行で入力してください。');
  return setDay(data, date, { entries: (data.days[date]?.entries ?? []).map(e => e.id === id ? { ...e, elapsedTitle } : e) });
}
export function moveItem<T extends { id: string }>(items: T[], id: string, targetId: string): T[] {
  const from = items.findIndex(i => i.id === id), to = items.findIndex(i => i.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); return next;
}
export function activeOptions(data: Data): Option[] { return data.titles.filter(o => !o.deleted); }
export function removeOption(data: Data, id: string): Data { return { ...data, titles: data.titles.map(o => o.id === id ? { ...o, deleted: true as const } : o) }; }
export function saveOption(data: Data, option: Option): Data {
  const name = option.name.trim();
  if (!name || /[\r\n]/.test(name)) throw new Error('名前を1行で入力してください。');
  if (data.titles.some(o => !o.deleted && o.id !== option.id && o.name === name)) throw new Error('同じ名前が登録されています。');
  const old = data.titles.find(o => o.id === option.id);
  if (old?.deleted) throw new Error('削除済みの候補は編集できません。');
  return { ...data, titles: old ? data.titles.map(o => o.id === option.id ? { ...option, name } : o) : [...data.titles, { ...option, name }] };
}
function presetName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) throw new Error('名前を1行で入力してください。');
  return trimmed;
}
export function findPreset(data: Data, name: string): Preset | undefined { return data.presets?.find(p => p.name === name.trim()); }
// その日の予定からプリセットを作る。同じ名前があれば中身を置き換える（上書きの確認は画面側で行う）。
export function savePreset(data: Data, date: string, name: string): Data {
  const entries = sortedEntries(data.days[date]?.entries ?? []).map(({ id: _id, ...rest }) => ({ ...rest }));
  if (!entries.length) throw new Error('この日には予定がありません。');
  const trimmed = presetName(name), presets = data.presets ?? [], existing = presets.find(p => p.name === trimmed);
  return { ...data, presets: existing ? presets.map(p => p.id === existing.id ? { ...p, entries } : p) : [...presets, { id: createId(), name: trimmed, entries }] };
}
export function renamePreset(data: Data, id: string, name: string): Data {
  const trimmed = presetName(name), presets = data.presets ?? [];
  if (!presets.some(p => p.id === id)) throw new Error('プリセットが見つかりません。');
  if (presets.some(p => p.id !== id && p.name === trimmed)) throw new Error('同じ名前のプリセットがあります。');
  return { ...data, presets: presets.map(p => p.id === id ? { ...p, name: trimmed } : p) };
}
export function removePreset(data: Data, id: string): Data { return { ...data, presets: (data.presets ?? []).filter(p => p.id !== id) }; }
// プリセットをその日に反映する。replace は時刻をすべて置き換え、add は同じ絶対時刻の予定を飛ばして追加する。
export function applyPreset(data: Data, date: string, id: string, mode: 'replace' | 'add'): { data: Data; added: number; skipped: number } {
  const preset = data.presets?.find(p => p.id === id);
  if (!preset) throw new Error('プリセットが見つかりません。');
  const current = mode === 'replace' ? [] : data.days[date]?.entries ?? [], taken = new Set(current.map(absoluteTime)), added: Entry[] = [];
  for (const entry of preset.entries) {
    if (taken.has(absoluteTime(entry))) continue;
    taken.add(absoluteTime(entry)); added.push({ ...entry, id: createId() });
  }
  return { data: setDay(data, date, { entries: [...current, ...added] }), added: added.length, skipped: preset.entries.length - added.length };
}
export function orderOptions(data: Data, options: Option[]): Data { return { ...data, titles: [...options, ...data.titles.filter(o => o.deleted)] }; }
