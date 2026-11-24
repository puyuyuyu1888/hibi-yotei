import { absoluteTime, dateKey, normalizeTime, validDate, type Data } from './model';
export const BACKUP_FORMAT = 'hibi-timeline-backup';
export const BACKUP_SCHEMA_VERSION = 1;
type RecordValue = Record<string, unknown>;
function invalid(detail: string): never { throw new Error(`バックアップが正しくありません：${detail}`); }
function record(value: unknown, keys: string[]): asserts value is RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid('データ構造が不正です。');
  if (Object.keys(value).some(key => !keys.includes(key))) invalid('未対応の項目があります。');
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) invalid('IDが不正です。');
}
function text(value: unknown, singleLine = false): asserts value is string {
  if (typeof value !== 'string' || singleLine && /[\r\n]/.test(value)) invalid('文字列が不正です。');
}
export function validateData(value: unknown): Data {
  record(value, ['version', 'titles', 'days', 'featureMemo', 'presets']);
  if (value.version !== 2) invalid('未対応のデータバージョンです。');
  if ('featureMemo' in value) text(value.featureMemo);
  if (!Array.isArray(value.titles)) invalid('タイトル候補がありません。');
  const ids = new Set<string>(), names = new Set<string>();
  for (const option of value.titles) {
    record(option, ['id', 'name', 'deleted']); id(option.id); text(option.name, true);
    if (!option.name.trim() || option.name !== option.name.trim() || ids.has(option.id) || 'deleted' in option && option.deleted !== true) invalid('タイトル候補が不正です。');
    if (!option.deleted && names.has(option.name)) invalid('タイトル候補が重複しています。');
    ids.add(option.id); if (!option.deleted) names.add(option.name);
  }
  if (!value.days || typeof value.days !== 'object' || Array.isArray(value.days)) invalid('日付データがありません。');
  const entryIds = new Set<string>();
  for (const [date, day] of Object.entries(value.days)) {
    if (!validDate(date)) invalid('日付が不正です。');
    record(day, ['title', 'memo', 'entries']); text(day.title, true); text(day.memo);
    if (!Array.isArray(day.entries)) invalid('時刻一覧がありません。');
    const times = new Set<number>();
    for (const entry of day.entries) {
      record(entry, ['id', 'time', 'nextDay', 'freeTitle', 'titleId', 'elapsedTitle']); id(entry.id);
      if (entryIds.has(entry.id)) invalid('時刻IDが重複しています。'); entryIds.add(entry.id);
      text(entry.time); text(entry.freeTitle, true); text(entry.elapsedTitle, true);
      if (typeof entry.nextDay !== 'boolean') invalid('翌日の指定が不正です。');
      if (entry.titleId !== null && (typeof entry.titleId !== 'string' || !ids.has(entry.titleId))) invalid('タイトル候補の参照先がありません。');
      if (!entry.freeTitle.trim() && entry.titleId === null) invalid('時刻タイトルがありません。');
      let total: number;
      try { if (normalizeTime(entry.time) !== entry.time) invalid('時刻はHH:MM形式が必要です。'); total = absoluteTime(entry as unknown as Data['days'][string]['entries'][number]); }
      catch { return invalid('時刻が不正です。'); }
      if (times.has(total)) invalid('同じ絶対時刻が重複しています。'); times.add(total);
    }
  }
  // プリセット（省略可能）。ない既存データ・バックアップもそのまま読み込む。
  if ('presets' in value) {
    if (!Array.isArray(value.presets)) invalid('プリセットが不正です。');
    const presetIds = new Set<string>(), presetNames = new Set<string>();
    for (const preset of value.presets) {
      record(preset, ['id', 'name', 'entries']); id(preset.id); text(preset.name, true);
      if (!preset.name.trim() || preset.name !== preset.name.trim() || presetIds.has(preset.id) || presetNames.has(preset.name)) invalid('プリセットが不正です。');
      presetIds.add(preset.id); presetNames.add(preset.name);
      if (!Array.isArray(preset.entries)) invalid('プリセットの時刻一覧がありません。');
      const times = new Set<number>();
      for (const entry of preset.entries) {
        record(entry, ['time', 'nextDay', 'freeTitle', 'titleId', 'elapsedTitle']);
        text(entry.time); text(entry.freeTitle, true); text(entry.elapsedTitle, true);
        if (typeof entry.nextDay !== 'boolean') invalid('翌日の指定が不正です。');
        if (entry.titleId !== null && (typeof entry.titleId !== 'string' || !ids.has(entry.titleId))) invalid('タイトル候補の参照先がありません。');
        if (!entry.freeTitle.trim() && entry.titleId === null) invalid('時刻タイトルがありません。');
        let total: number;
        try { if (normalizeTime(entry.time) !== entry.time) invalid('時刻はHH:MM形式が必要です。'); total = absoluteTime(entry as unknown as Data['days'][string]['entries'][number]); }
        catch { return invalid('時刻が不正です。'); }
        if (times.has(total)) invalid('同じ絶対時刻が重複しています。'); times.add(total);
      }
    }
  }
  return value as unknown as Data;
}
export function parseBackup(source: string): Data {
  let value: unknown;
  try { value = JSON.parse(source.replace(/^\uFEFF/, '')); } catch { return invalid('JSONを読み込めません。'); }
  record(value, ['format', 'schemaVersion', 'exportedAt', 'data']);
  if (value.format !== BACKUP_FORMAT) invalid('新仕様のバックアップではありません。');
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) invalid('未対応のバックアップバージョンです。');
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) || new Date(value.exportedAt).toISOString() !== value.exportedAt) invalid('出力日時が不正です。');
  return validateData(value.data);
}
export function serializeBackup(data: Data, now = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), data: validateData(data) }, null, 2);
}
export function backupFilename(now = new Date()): string { return `schedule-backup-${dateKey(now).replaceAll('-', '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`; }
export function downloadBackup(data: Data): void {
  if (typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function' || !('download' in document.createElement('a'))) throw new Error('このブラウザーではファイルを保存できません。');
  const now = new Date(), url = URL.createObjectURL(new Blob([serializeBackup(data, now)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = backupFilename(now);
  try { document.body.appendChild(link); link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}
export function readBackupFile(file: File): Promise<Data> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { try { resolve(parseBackup(String(reader.result))); } catch (error) { reject(error); } };
    reader.onerror = reader.onabort = () => reject(new Error('ファイルを読み込めませんでした。'));
    reader.readAsText(file, 'UTF-8');
  });
}
