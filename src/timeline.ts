import { absoluteTime, dateKey, sortedEntries, type Entry } from './model';
export function formatElapsed(elapsed: number): string {
  if (!Number.isInteger(elapsed) || elapsed < 0) throw new Error('経過時間が不正です。');
  const hours = Math.floor(elapsed / 60), rest = elapsed % 60;
  return hours ? `${hours}時間${rest ? `${rest}分` : ''}` : `${rest}分`;
}
export const pointTime = (entry: Entry): string => `${entry.nextDay ? '翌' : ''}${entry.time}`;
export type TimelineRow = { kind: 'time'; entry: Entry } | { kind: 'elapsed'; entry: Entry; endId: string; minutes: number };
export function timelineRows(entries: readonly Entry[]): TimelineRow[] {
  const sorted = sortedEntries(entries);
  return sorted.flatMap((entry, i): TimelineRow[] => {
    const next = sorted[i + 1];
    return [{ kind: 'time', entry }, ...(next ? [{ kind: 'elapsed' as const, entry, endId: next.id, minutes: absoluteTime(next) - absoluteTime(entry) }] : [])];
  });
}
export function currentTimelineRow(date: string, entries: readonly Entry[], now: Date): string | undefined {
  if (date !== dateKey(now)) return;
  const current = now.getHours() * 60 + now.getMinutes(), sorted = sortedEntries(entries);
  const exact = sorted.find(e => absoluteTime(e) === current);
  if (exact) return `time:${exact.id}`;
  const start = sorted.find((e, i) => sorted[i + 1] && absoluteTime(e) < current && current < absoluteTime(sorted[i + 1]));
  return start ? `elapsed:${start.id}` : undefined;
}
