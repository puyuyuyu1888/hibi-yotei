import { initialData, type Data } from './model';
import { validateData } from './backup';

type FallbackDatabase = { mode: 'local'; storage: Storage; key: string; close: () => void } |
  { mode: 'memory'; close: () => void };
export type AppDatabase = IDBDatabase | FallbackDatabase;

export async function openAppDatabase(documentLocation: Pick<Location, 'protocol' | 'pathname'> = window.location): Promise<AppDatabase> {
  const localFile = !['http:', 'https:'].includes(documentLocation.protocol);
  try {
    return await openDatabase(localFile ? `hibi-timeline-v2:file:${documentLocation.pathname}` : 'hibi-timeline-v2');
  } catch (error) {
    try {
      const storage = window.localStorage;
      const key = localFile ? `hibi-timeline-v2:file:${documentLocation.pathname}` : 'hibi-timeline-v2';
      const probe = `${key}:probe`;
      storage.setItem(probe, '1');
      if (storage.getItem(probe) !== '1') throw new Error('端末に保存できません。');
      storage.removeItem(probe);
      return { mode: 'local', storage, key, close: () => {} };
    } catch {
      return { mode: 'memory', close: () => {} };
    }
  }
}

export function openDatabase(name = 'hibi-timeline-v2'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('app');
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('ほかの画面を閉じて再読み込みしてください。'));
  });
}
export async function loadData(db: AppDatabase): Promise<Data> {
  await recoverImport(db);
  return validateData(await readData(db));
}
async function readData(db: AppDatabase): Promise<Data> {
  if ('mode' in db) {
    if (db.mode === 'memory') return initialData();
    const saved = db.storage.getItem(db.key);
    return saved === null ? initialData() : JSON.parse(saved);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('app', 'readonly');
    const request = tx.objectStore('app').get('data');
    tx.oncomplete = () => resolve(request.result ?? initialData());
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('読み込みに失敗しました。'));
  });
}
export async function persistData(db: AppDatabase, data: Data): Promise<void> {
  await recoverImport(db);
  if ('mode' in db) {
    if (db.mode === 'memory') throw new Error('端末に保存できません。');
    db.storage.setItem(db.key, JSON.stringify(data));
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('app', 'readwrite');
    tx.objectStore('app').put(data, 'data');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('保存に失敗しました。'));
  });
}

const RECOVERY_KEY = 'import-recovery';
type Recovery = { hadData: boolean; previous: unknown };
function transaction(db: IDBDatabase, operation: (store: IDBObjectStore, tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('app', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保存に失敗しました。'));
    tx.onabort = () => reject(tx.error ?? new Error('保存を中止しました。'));
    try { operation(tx.objectStore('app'), tx); } catch (error) { tx.abort(); reject(error); }
  });
}
async function recoverImport(db: AppDatabase): Promise<void> {
  if ('mode' in db) {
    if (db.mode === 'memory') return;
    const recoveryKey = `${db.key}:${RECOVERY_KEY}`;
    const raw = db.storage.getItem(recoveryKey);
    if (raw === null) return;
    const recovery = JSON.parse(raw) as { previous: string | null };
    if (!recovery || !Object.hasOwn(recovery, 'previous') || (recovery.previous !== null && typeof recovery.previous !== 'string')) throw new Error('回復情報を読み込めませんでした。');
    if (recovery.previous === null) db.storage.removeItem(db.key);
    else db.storage.setItem(db.key, recovery.previous);
    if (db.storage.getItem(db.key) !== recovery.previous) throw new Error('元のデータの復元を確認できませんでした。');
    db.storage.removeItem(recoveryKey);
    return;
  }
  await transaction(db, (store, tx) => {
    const request = store.get(RECOVERY_KEY);
    request.onsuccess = () => {
      if (request.result === undefined) return;
      try {
        const recovery = request.result as Recovery;
        if (!recovery || typeof recovery.hadData !== 'boolean' || !Object.hasOwn(recovery, 'previous')) throw new Error('回復情報が不正です。');
        if (recovery.hadData) store.put(recovery.previous, 'data'); else store.delete('data');
        store.delete(RECOVERY_KEY);
      } catch { tx.abort(); }
    };
  });
}
export async function replaceData(db: AppDatabase, data: Data): Promise<Data> {
  const replacement = validateData(JSON.parse(JSON.stringify(data)));
  await recoverImport(db);
  try {
    if ('mode' in db) {
      if (db.mode === 'memory') throw new Error('このブラウザーでは端末に保存できません。');
      // setItem is atomic for one key; retain the previous value until verification.
      const previous = db.storage.getItem(db.key);
      db.storage.setItem(`${db.key}:${RECOVERY_KEY}`, JSON.stringify({ previous }));
      db.storage.setItem(db.key, JSON.stringify(replacement));
    } else {
      // The old snapshot and replacement are committed together. A quota error or
      // aborted transaction leaves the original snapshot intact.
      await transaction(db, (store, tx) => {
        const old = store.get('data');
        old.onsuccess = () => {
          try {
            store.put({ hadData: old.result !== undefined, previous: old.result } satisfies Recovery, RECOVERY_KEY);
            store.put(replacement, 'data');
            const check = store.get('data');
            check.onsuccess = () => { if (JSON.stringify(check.result) !== JSON.stringify(replacement)) tx.abort(); };
          } catch { tx.abort(); }
        };
      });
    }
    // Verify in a new transaction, after the replacement actually committed.
    const saved = await readData(db);
    if (JSON.stringify(saved) !== JSON.stringify(replacement)) throw new Error('保存内容を確認できませんでした。');
    validateData(saved);
    if ('mode' in db) {
      if (db.mode === 'local') db.storage.removeItem(`${db.key}:${RECOVERY_KEY}`);
    } else await transaction(db, store => { store.delete(RECOVERY_KEY); });
    return saved;
  } catch (error) {
    try { await recoverImport(db); }
    catch { throw new Error('復元に失敗しました。元データの回復情報を保持しています。再読み込みしてください。'); }
    if ('mode' in db && db.mode === 'memory') throw error;
    throw new Error('復元に失敗しました。変更前の保存データは保持されています。');
  }
}
