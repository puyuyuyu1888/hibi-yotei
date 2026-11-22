import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { DataManager } from './DataManager';
import { initialData } from './model';
import { downloadBackup, readBackupFile } from './backup';
vi.mock('./backup',()=>({downloadBackup:vi.fn(),readBackupFile:vi.fn()}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('出力は現在の全データを使い、入力は確認・キャンセル後にのみ置換する',async()=>{
  const data=initialData(),restore=vi.fn().mockResolvedValue(undefined),busy=vi.fn();vi.mocked(readBackupFile).mockResolvedValue(data);render(<DataManager getData={()=>data} onImport={restore} onBusyChange={busy}/>);
  fireEvent.click(screen.getByRole('button',{name:'エクスポート'}));expect(downloadBackup).toHaveBeenCalledWith(data);
  const input=screen.getByLabelText('バックアップJSON');fireEvent.change(input,{target:{files:[new File(['{}'],'backup.json')]}});await screen.findByRole('dialog');expect(restore).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'キャンセル'}));expect(restore).not.toHaveBeenCalled();
  fireEvent.change(input,{target:{files:[new File(['{}'],'backup.json')]}});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'置き換えて復元'}));await waitFor(()=>expect(restore).toHaveBeenCalledWith(data));
});
it('不正なファイルでは置換せずエラーを表示する',async()=>{vi.mocked(readBackupFile).mockRejectedValue(Error('不正なJSON'));const restore=vi.fn();render(<DataManager getData={initialData} onImport={restore} onBusyChange={()=>{}}/>);fireEvent.change(screen.getByLabelText('バックアップJSON'),{target:{files:[new File(['bad'],'bad.json')]}});expect((await screen.findByRole('alert')).textContent).toContain('不正');expect(restore).not.toHaveBeenCalled();});
