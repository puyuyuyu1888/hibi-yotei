import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { initialData } from './model';
import { loadData, openAppDatabase, persistData } from './storage';
import * as timeline from './timeline';
vi.mock('./storage',()=>({openAppDatabase:vi.fn(),loadData:vi.fn(),persistData:vi.fn(),replaceData:vi.fn(),listImages:vi.fn(async()=>[]),addImage:vi.fn(),deleteImage:vi.fn()}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});localStorage.clear();vi.mocked(openAppDatabase).mockResolvedValue({close:()=>{}} as any);vi.mocked(loadData).mockResolvedValue(initialData());vi.mocked(persistData).mockResolvedValue();});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('メモ入力を局所更新し、日付タイトルも含めて離脱時に保存する',async()=>{
  const rows=vi.spyOn(timeline,'timelineRows');render(<App/>);fireEvent.click((await screen.findAllByRole('button',{name:/^\d{4}-\d{2}-\d{2}/}))[10]);
  const memo=screen.getByRole('textbox',{name:'メモ'}),calls=rows.mock.calls.length;fireEvent.change(memo,{target:{value:'  日本語\nメモ  '}});expect(rows).toHaveBeenCalledTimes(calls);expect(persistData).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('日付タイトル'),{target:{value:'通常日'}});fireEvent.click(screen.getByRole('button',{name:'カレンダーに戻る'}));await waitFor(()=>expect(persistData).toHaveBeenCalledTimes(1));expect(Object.values(vi.mocked(persistData).mock.calls[0][1].days)[0]).toMatchObject({title:'通常日',memo:'  日本語\nメモ  '});
});
it('入力UIは時刻・自由入力・単一選択、決定・キャンセル・翌日の2行構成',async()=>{
  render(<App/>);fireEvent.click((await screen.findAllByRole('button',{name:/^\d{4}-\d{2}-\d{2}/}))[10]);fireEvent.click(screen.getByRole('button',{name:'時刻・画像を追加'}));fireEvent.click(screen.getByRole('button',{name:'時刻を追加'}));
  const selection=screen.getByRole('combobox',{name:'タイトル選択'}) as HTMLSelectElement;expect(selection.multiple).toBe(false);expect((screen.getByRole('checkbox',{name:'翌日'}) as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText('時刻'),{target:{value:'08:00'}});fireEvent.submit(screen.getByRole('form',{name:'時刻の追加'}));expect((await screen.findByRole('alert')).textContent).toContain('タイトル');
  fireEvent.change(screen.getByLabelText('自由入力タイトル'),{target:{value:'朝の'}});fireEvent.change(selection,{target:{value:'title-1'}});fireEvent.change(selection,{target:{value:''}});expect((screen.getByLabelText('自由入力タイトル') as HTMLInputElement).value).toBe('朝の');
  fireEvent.change(selection,{target:{value:'title-1'}});fireEvent.click(screen.getByRole('button',{name:'決定'}));expect(await screen.findByText('朝の準備')).toBeTruthy();expect(screen.queryByLabelText(/時間の連続性/)).toBeNull();
});
it('保存エラーを表示し入力を保持して再試行する',async()=>{
  render(<App/>);fireEvent.click((await screen.findAllByRole('button',{name:/^\d{4}-\d{2}-\d{2}/}))[10]);vi.mocked(persistData).mockRejectedValueOnce(new DOMException('Full','QuotaExceededError'));
  fireEvent.change(screen.getByLabelText('メモ'),{target:{value:'保持する'}});fireEvent.blur(screen.getByLabelText('メモ'));expect((await screen.findByRole('alert')).textContent).toContain('容量');expect((screen.getByLabelText('メモ') as HTMLTextAreaElement).value).toBe('保持する');fireEvent.click(screen.getByRole('button',{name:'再試行'}));await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
});
it('読み込み失敗時は初期データで上書きしない',async()=>{vi.mocked(loadData).mockRejectedValueOnce(Error());render(<App/>);expect((await screen.findByRole('alert')).textContent).toContain('読み込めません');expect(persistData).not.toHaveBeenCalled();});
