import { validateData } from './backup';
import type { Data } from './model';
export const AUTOSAVE_DELAY = 500;
export function autosaveKey(location: Pick<Location, 'protocol' | 'pathname'> = window.location): string {
  return `hibi-timeline-v2:${['http:', 'https:'].includes(location.protocol) ? 'web' : `file:${location.pathname}`}:draft`;
}
type Options = { save: (data: Data) => Promise<void>; key: string; onError: (error: unknown) => void; storage?: () => Storage };
// All edits share one immutable snapshot and one serial write queue.
export class Autosave {
  data: Data | null = null;
  private base = '';
  private candidates = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private scheduled = -1;
  private dirty = false;
  private queue: Promise<void> = Promise.resolve();
  constructor(private options: Options) {}
  private storage(): Storage { return this.options.storage ? this.options.storage() : window.localStorage; }
  initialize(saved: Data): Data {
    this.data = saved; this.base = JSON.stringify(saved);
    let raw: string | null;
    try { raw = this.storage().getItem(this.options.key); } catch { return saved; }
    if (raw === null) return saved;
    const journal = JSON.parse(raw);
    if (journal?.version !== 1 || typeof journal.base !== 'string' || !Array.isArray(journal.candidates) || journal.candidates.some((s: unknown) => typeof s !== 'string')) throw new Error('未保存データの回復情報が不正です。');
    const draft = validateData(journal.data);
    if (JSON.stringify(draft) !== this.base && (journal.base === this.base || journal.candidates.includes(this.base))) {
      this.data = draft; this.dirty = true; this.revision++;
    }
    return this.data;
  }
  update(data: Data, immediate = false): void {
    this.data = data; this.dirty = true; this.revision++; clearTimeout(this.timer);
    if (immediate) void this.flush().catch(() => {});
    else this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, AUTOSAVE_DELAY);
  }
  private checkpoint(): void {
    if (!this.dirty) { this.storage().removeItem(this.options.key); return; }
    this.storage().setItem(this.options.key, JSON.stringify({ version: 1, base: this.base, candidates: [...this.candidates], data: this.data }));
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.data || !this.dirty || this.scheduled === this.revision) return this.queue;
    const snapshot = this.data, revision = this.revision, serialized = JSON.stringify(snapshot);
    this.scheduled = revision; this.candidates.add(serialized);
    try { this.checkpoint(); } catch { /* Primary storage is still attempted. */ }
    this.queue = this.queue.catch(() => {}).then(() => this.options.save(snapshot)).then(() => {
      this.base = serialized; this.candidates.delete(serialized);
      if (revision === this.revision) this.dirty = false;
      try { this.checkpoint(); } catch (error) { if (this.dirty) this.options.onError(error); }
    }).catch(error => { if (this.scheduled === revision) this.scheduled = -1; this.options.onError(error); throw error; });
    return this.queue;
  }
  leave(): void {
    if (this.dirty) { try { this.checkpoint(); } catch (error) { this.options.onError(error); } }
    void this.flush().catch(() => {});
  }
  async prepareImport(): Promise<void> {
    await this.flush();
    // A stale journal must never overwrite an imported dataset.
    this.storageIfAvailable()?.removeItem(this.options.key);
  }
  private storageIfAvailable(): Storage | null { try { return this.storage(); } catch { return null; } }
  acceptSaved(data: Data): void { this.data = data; this.base = JSON.stringify(data); this.dirty = false; this.candidates.clear(); this.revision++; this.scheduled = -1; clearTimeout(this.timer); }
  stop(): void { clearTimeout(this.timer); }
}
