import { useRef, useState } from 'react';
import { downloadBackup, readBackupFile } from './backup';
import type { Data } from './model';
import { Modal } from './Modal';

type Props = { getData: () => Data; onImport: (data: Data) => Promise<void>; onBusyChange: (busy: boolean) => void };
export function DataManager({ getData, onImport, onBusyChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const lock = (value: boolean) => { locked.current = value; setBusy(value); onBusyChange(value); };
  const restore = async () => {
    if (locked.current || !pending) return;
    lock(true); setError('');
    try { await onImport(pending); setPending(null); }
    catch (e) { setPending(null); setError((e as Error).message || '復元に失敗しました。'); }
    finally { lock(false); }
  };
  return <section className="data-manager" aria-label="データ管理">
    <button className="secondary" disabled={busy || !!pending} onClick={() => {
      setError(''); try { downloadBackup(getData()); } catch (e) { setError((e as Error).message || 'ファイルを保存できませんでした。'); }
    }}>エクスポート</button>
    <button className="secondary" disabled={busy || !!pending} onClick={() => {
      setError('');
      try {
        if (typeof FileReader === 'undefined' || !fileInput.current || fileInput.current.type !== 'file') throw new Error('ファイル選択に未対応');
        fileInput.current.click();
      } catch { setError('このブラウザーではファイルを選択・読み込みできません。'); }
    }}>インポート</button>
    <input ref={fileInput} type="file" accept=".json,application/json" aria-label="バックアップJSON" hidden disabled={busy} onChange={async e => {
      const file = e.currentTarget.files?.[0]; e.currentTarget.value = '';
      if (!file || locked.current) return;
      lock(true); setError('');
      try { setPending(await readBackupFile(file)); }
      catch (error) { setError((error as Error).message || 'ファイルを読み込めませんでした。'); }
      finally { lock(false); }
    }} />
    {error && <p className="field-error" role="alert">{error}</p>}
    {pending && <Modal title="インポートの確認" busy={busy} onClose={() => setPending(null)}>
      <p className="confirm-text">現在の予定・選択肢・設定はすべて削除され、バックアップの内容に置き換わります。</p>
      <div className="confirm-actions"><button className="secondary" disabled={busy} onClick={() => setPending(null)}>キャンセル</button><button className="primary" disabled={busy} onClick={() => void restore()}>{busy ? '復元中…' : '置き換えて復元'}</button></div>
    </Modal>}
  </section>;
}
