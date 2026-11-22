import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { activeOptions, calendarDays, clearEntries, createId, dateKey, displayTitle, emptyDay, orderOptions, parseDate, removeEntry, removeOption, saveEntry, saveOption, setDay, setElapsedTitle, type Data, type Entry, type Option } from './model';
import { loadData, openAppDatabase, persistData, replaceData, type AppDatabase } from './storage';
import { Autosave, autosaveKey } from './autosave';
import { currentTimelineRow, formatElapsed, pointTime, timelineRows } from './timeline';
import { SortableList } from './SortableList';
import { OptionSelect } from './OptionSelect';
import { DataManager } from './DataManager';
import { Modal } from './Modal';
import { MemoField } from './MemoField';
import { TenDayList, type ListPosition } from './TenDayList';
import { buildAiReview, copyReviewText } from './aiCopy';
const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
function Icon({ name }: { name: 'back' | 'left' | 'right' | 'menu' | 'trash' }) {
  const paths = { back: 'm14 6-6 6 6 6M8 12h12', left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6', menu: 'M5 6h14M5 12h14M5 18h14', trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7' };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
type EditorState = { mode: 'new' | 'edit'; entry: Entry };
function EntryEditor({ state, data, onSave, onCancel, onDelete }: {
  state: EditorState; data: Data; onSave: (entry: Entry, created: Option[]) => Promise<void>; onCancel: () => void; onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ ...state.entry }), [created, setCreated] = useState<Option[]>([]);
  const [error, setError] = useState(''), [adding, setAdding] = useState(false), [confirmDelete, setConfirmDelete] = useState(false), [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const patch = (values: Partial<Entry>) => setDraft(old => ({ ...old, ...values }));
  const createTitle = (name: string): string => {
    const option = { id: createId(), name: name.trim() };
    saveOption({ ...data, titles: [...data.titles, ...created] }, option);
    setCreated(old => [...old, option]); return option.id;
  };
  const submit = async (deleting = false) => {
    if (locked.current) return;
    locked.current = true; setSaving(true); setError('');
    try { if (deleting) await onDelete(); else await onSave(draft, created); }
    catch (error) { setError((error as DOMException)?.name === 'QuotaExceededError' ? '保存容量が不足しています。' : (error as Error).message || '保存できませんでした。'); }
    finally { locked.current = false; setSaving(false); }
  };
  return <Modal className="time-modal" title={confirmDelete ? '時刻を削除' : state.mode === 'new' ? '新規時刻入力' : '時刻の修正'} busy={saving} onClose={onCancel}>
    {confirmDelete ? <>
      <p className="confirm-text">この時刻を削除しますか？</p>
      {state.entry.elapsedTitle && <p className="confirm-text">経過時間タイトル「{state.entry.elapsedTitle}」も削除されます。</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="confirm-actions"><button className="secondary" disabled={saving} onClick={() => { setConfirmDelete(false); setError(''); }}>キャンセル</button><button className="danger-fill" disabled={saving} onClick={() => void submit(true)}>削除</button></div>
    </> : <form className="entry-editor" aria-label={state.mode === 'edit' ? '時刻の編集' : '時刻の追加'} noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={saving}>
        <div className="editor-input-row">
          <input aria-label="時刻" type="time" step="60" required value={draft.time} onChange={e => patch({ time: e.target.value })} />
          <input aria-label="自由入力タイトル" value={draft.freeTitle} onChange={e => patch({ freeTitle: e.target.value })} />
          <OptionSelect label="タイトル選択" options={[...data.titles, ...created]} value={draft.titleId ?? ''} emptyLabel="選択" onChange={id => patch({ titleId: id || null })} onCreate={createTitle} onAddingChange={setAdding} />
        </div>
        <div className="editor-control-row"><button className="primary" type="submit" disabled={adding}>決定</button><button className="secondary" type="button" onClick={onCancel}>キャンセル</button><label className="check-label"><input type="checkbox" checked={draft.nextDay} onChange={e => patch({ nextDay: e.target.checked })} />翌日</label></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {state.mode === 'edit' && <button className="danger text-button" type="button" onClick={() => { setError(''); setConfirmDelete(true); }}>削除</button>}
      </fieldset>
    </form>}
  </Modal>;
}
function DayTitle({ initial, onChange, onFlush }: { initial: string; onChange: (value: string) => void; onFlush: () => void }) {
  const [value, setValue] = useState(initial);
  return <input className="day-title" aria-label="日付タイトル" value={value} onChange={e => { setValue(e.target.value); onChange(e.target.value); }} onBlur={onFlush} />;
}
function ManualCopy({ text }: { text: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const select = () => { field.current?.focus(); field.current?.select(); field.current?.setSelectionRange(0, text.length); };
  useEffect(select, [text]);
  return <div className="manual-copy"><p className="field-error">自動コピーできませんでした。</p><textarea ref={field} aria-label="AI確認用テキスト" readOnly value={text} rows={12} /><button className="secondary" onClick={select}>すべて選択</button></div>;
}
function ElapsedContent({ entry, minutes, onDraft, onFlush }: { entry: Entry; minutes: number; onDraft: (value: string) => void; onFlush: () => void }) {
  const [editing, setEditing] = useState(false), [text, setText] = useState(entry.elapsedTitle);
  const duration = `（${formatElapsed(minutes)}）`;
  return editing ? <div className="elapsed-content"><input autoFocus aria-label="経過時間タイトル" value={text} onChange={e => { setText(e.target.value); onDraft(e.target.value); }} onBlur={() => { onFlush(); setEditing(false); }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }} /><span className="entry-duration">{duration}</span></div>
    : <button className="elapsed-content" aria-label={`${text}${duration}を編集`} onClick={() => setEditing(true)}><span className="entry-title">{text}</span><span className="entry-duration">{duration}</span></button>;
}
function Manager({ data, update }: { data: Data; update: (data: Data) => void }) {
  const [edit, setEdit] = useState<Option | null>(null), [name, setName] = useState(''), [deleting, setDeleting] = useState<Option | null>(null), [error, setError] = useState('');
  return <div className="manager">
    <SortableList items={activeOptions(data)} onChange={items => update(orderOptions(data, items))} label={t => t.name} render={option => <><button className="option-row" onClick={() => { setEdit(option); setName(option.name); setError(''); }}>{option.name}</button><button className="icon-button danger" aria-label={`${option.name}を削除`} onClick={() => setDeleting(option)}><Icon name="trash" /></button></>} />
    <button className="add-option secondary" onClick={() => { setEdit({ id: createId(), name: '' }); setName(''); setError(''); }}>＋ 追加</button>
    {edit && <Modal title={data.titles.some(t => t.id === edit.id) ? '名前を編集' : '新規追加'} onClose={() => setEdit(null)}><form className="option-editor" onSubmit={e => { e.preventDefault(); try { update(saveOption(data, { ...edit, name })); setEdit(null); } catch (error) { setError((error as Error).message); } }}>
      <label>名前<input autoFocus required value={name} onChange={e => setName(e.target.value)} /></label>{error && <p className="field-error" role="alert">{error}</p>}
      <div className="editor-actions"><button type="button" className="secondary" onClick={() => setEdit(null)}>キャンセル</button><button className="primary">保存</button></div>
    </form></Modal>}
    {deleting && <Modal title="候補を削除" onClose={() => setDeleting(null)}><p className="confirm-text">「{deleting.name}」を削除しますか？</p><div className="confirm-actions"><button className="secondary" onClick={() => setDeleting(null)}>キャンセル</button><button className="danger-fill" onClick={() => { update(removeOption(data, deleting.id)); setDeleting(null); setEdit(null); }}>削除</button></div></Modal>}
  </div>;
}
function ClearDayConfirm({ date, entries, now, onConfirm, onCancel }: { date: string; entries: Entry[]; now: Date; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const target = parseDate(date), titled = entries.filter(e => e.elapsedTitle.trim()).length;
  const label = `${target.getFullYear() === now.getFullYear() ? '' : `${target.getFullYear()}年`}${target.getMonth() + 1}月${target.getDate()}日（${['日', '月', '火', '水', '木', '金', '土'][target.getDay()]}）`;
  const confirm = async () => {
    if (locked.current) return;
    locked.current = true; setSaving(true); setError('');
    try { await onConfirm(); }
    catch (error) { setError((error as DOMException)?.name === 'QuotaExceededError' ? '保存容量が不足しています。' : (error as Error).message || '保存できませんでした。'); }
    finally { locked.current = false; setSaving(false); }
  };
  return <Modal className="time-modal" title="予定を全削除" busy={saving} onClose={onCancel}>
    <p className="confirm-text">{label}の時刻{entries.length}件{titled ? `と、経過時間タイトル${titled}件` : ''}を削除します。日付タイトルとメモは残ります。</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="confirm-actions"><button className="secondary" disabled={saving} onClick={onCancel}>キャンセル</button><button className="danger-fill" disabled={saving} onClick={() => void confirm()}>削除</button></div>
  </Modal>;
}
function FeatureMemo({ initial, onDraft, onFlush }: { initial: string; onDraft: (value: string) => void; onFlush: () => void }) {
  const [value, setValue] = useState(initial);
  return <section className="feature-memo" aria-label="全体メモ"><textarea className="feature-memo-text" aria-label="全体メモ" value={value} onChange={e => { setValue(e.target.value); onDraft(e.target.value); }} onBlur={onFlush} /></section>;
}
export default function App() {
  const [data, setData] = useState<Data | null>(null), [storageError, setStorageError] = useState(''), [storageNotice, setStorageNotice] = useState(''), [loadError, setLoadError] = useState(false);
  const db = useRef<AppDatabase | null>(null), saverRef = useRef<Autosave | null>(null);
  saverRef.current ??= new Autosave({ key: autosaveKey(), save: async next => { await persistData(db.current!, next); setStorageError(''); }, onError: error => setStorageError((error as DOMException)?.name === 'QuotaExceededError' ? '保存容量が不足しています。入力内容は保持しています。' : '保存できませんでした。入力内容は保持しています。') });
  const saver = saverRef.current;
  const [now, setNow] = useState(() => new Date()), [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState<string | null>(null), [view, setView] = useState<'calendar' | 'ten-days'>('calendar');
  const listPosition = useRef<ListPosition | null>(null);
  const [menu, setMenu] = useState(false), [manager, setManager] = useState<'titles' | 'data' | 'memo' | null>(null), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [copyNotice, setCopyNotice] = useState(''), [manualCopy, setManualCopy] = useState<string | null>(null), [copyBusy, setCopyBusy] = useState(false);
  const copyLock = useRef(false);
  const [clearing, setClearing] = useState<Entry[] | null>(null);
  const init = async () => {
    setLoadError(false); setStorageError('');
    try {
      db.current ??= await openAppDatabase();
      setStorageNotice('mode' in db.current && db.current.mode === 'memory' ? 'このブラウザーでは端末に保存できません。閉じる前にエクスポートしてください。' : '');
      const saved = await loadData(db.current);
      const restored = saver.initialize(saved); setData(restored); void saver.flush().catch(() => {});
    } catch { setLoadError(true); setStorageError('データを読み込めませんでした。'); }
  };
  useEffect(() => { void init(); return () => { saver.leave(); saver.stop(); }; }, []);
  useEffect(() => {
    const leave = () => saver.leave();
    const visibility = () => { setNow(new Date()); if (document.visibilityState === 'hidden') leave(); };
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    window.addEventListener('pagehide', leave); window.addEventListener('beforeunload', leave); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', leave); window.removeEventListener('beforeunload', leave); document.removeEventListener('visibilitychange', visibility); };
  }, [saver]);
  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => setCopyNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [copyNotice]);
  const flush = useCallback(() => { void saver.flush().catch(() => {}); if (saver.data) setData(saver.data); }, [saver]);
  const update = (next: Data) => { if (!busy) { saver.update(next, true); setData(next); } };
  const textUpdate = (next: Data) => { if (!busy) saver.update(next); };
  const draftMemo = useCallback((date: string, memo: string) => { if (saver.data) saver.update(setDay(saver.data, date, { memo })); }, [saver]);
  const selectDate = (key: string) => { flush(); setSelected(key); setEditor(null); };
  const back = () => { if (busy) return; flush(); if (manager) setManager(null); else if (selected) { setSelected(null); setEditor(null); } else setView('calendar'); };
  const importData = async (replacement: Data) => {
    await saver.prepareImport(); const restored = await replaceData(db.current!, replacement); saver.acceptSaved(restored);
    setData(restored); setStorageError(''); setSelected(null); setEditor(null); setManager(null);
  };
  const commitTimeChange = async (next: Data) => {
    await saver.flush();
    await persistData(db.current!, next);
    saver.acceptSaved(next); setData(next); setStorageError(''); setEditor(null);
  };
  const copyForAi = async (container: HTMLElement) => {
    if (copyLock.current || !selected || manager || !saver.data) return;
    setCopyNotice('');
    const text = buildAiReview(selected, saver.data.days[selected]?.entries ?? [], saver.data.titles);
    if (text === null) { setMenu(false); setCopyNotice('予定がありません'); return; }
    copyLock.current = true; setCopyBusy(true);
    try {
      if (await copyReviewText(text, container)) { setMenu(false); setCopyNotice('コピーしました'); }
      else setManualCopy(text);
    } finally { copyLock.current = false; setCopyBusy(false); }
  };
  const startClear = () => {
    if (!selected || manager || !saver.data) return;
    flush();
    const entries = saver.data.days[selected]?.entries ?? [];
    setMenu(false); setCopyNotice('');
    if (!entries.length) { setCopyNotice('削除する予定がありません'); return; }
    setEditor(null); setClearing(entries);
  };
  const openMenu = () => { flush(); setManualCopy(null); setCopyNotice(''); setMenu(true); };
  const calendarScreen = !selected && !manager && view === 'calendar';
  // 月の切り替え（スワイプ・ドラッグ・← →キー）。slide はアニメーションの向き。
  const [slide, setSlide] = useState<'' | 'next' | 'prev'>('');
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null), swipedAt = useRef(-Infinity);
  const shiftMonth = (delta: number) => {
    setSlide(delta > 0 ? 'next' : 'prev');
    setMonth(old => { const d = new Date(old.year, old.month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  };
  useEffect(() => {
    if (!data || !calendarScreen || menu) return;
    const keydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || document.querySelector('dialog[open]')) return;
      if ((e.target as Element | null)?.closest?.('input,textarea,select,[contenteditable]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); shiftMonth(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); shiftMonth(1); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [data, calendarScreen, menu]);
  const swipeHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      const edge = 24; swipedAt.current = -Infinity;
      // 画面の左右の端から始めた操作は Android の「戻る」と競合するため扱わない。
      swipe.current = !e.isPrimary || e.button !== 0 || e.clientX < edge || e.clientX > window.innerWidth - edge ? null : { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const start = swipe.current; swipe.current = null;
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) >= 50 && Math.abs(dx) >= 1.5 * Math.abs(dy)) { swipedAt.current = e.timeStamp; shiftMonth(dx < 0 ? 1 : -1); }
    },
    onPointerCancel: () => { swipe.current = null; },
    // スワイプ直後のクリックでは日付を開かない。
    onClickCapture: (e: ReactMouseEvent) => { if (e.timeStamp - swipedAt.current < 600) { e.preventDefault(); e.stopPropagation(); } swipedAt.current = -Infinity; },
  };
  // 日付のマスは作り直さず（触れている要素を消さないため）、アニメーションだけをやり直す。
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current; if (!grid) return;
    grid.classList.remove('slide-next', 'slide-prev');
    if (slide) { void grid.offsetWidth; grid.classList.add(`slide-${slide}`); }
  }, [month, slide]);
  const day = data && selected ? data.days[selected] ?? emptyDay() : emptyDay();
  const today = dateKey(now), selectedDate = selected ? parseDate(selected) : null;
  const active = selected ? currentTimelineRow(selected, day.entries, now) : undefined;
  const headerTitle = manager ? manager === 'data' ? 'データ管理' : manager === 'memo' ? 'メモ' : '予定タイトル一覧' : selectedDate ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : view === 'ten-days' ? '予定一覧' : '日々の予定';
  return <main className={`app-shell${calendarScreen ? ' no-header' : ''}`}>
    {!calendarScreen && <header className="app-header">
      {(selected || manager || view === 'ten-days') ? <button className="icon-button back-button" aria-label={manager ? '管理画面を閉じる' : selected && view === 'ten-days' ? '予定一覧に戻る' : 'カレンダーに戻る'} disabled={busy} onClick={back}><Icon name="back" /></button> : <span className="brand-mark" aria-hidden="true">日</span>}
      <div className="header-title"><h1>{headerTitle}</h1>{selectedDate && !manager && <span className={`date-weekday weekday-${(selectedDate.getDay() + 6) % 7}`}>{['日', '月', '火', '水', '木', '金', '土'][selectedDate.getDay()]}曜日{selected === today ? ' ・ 今日' : ''}</span>}</div>
      <button className="icon-button" aria-label="メニュー" disabled={busy} onClick={openMenu}><Icon name="menu" /></button>
    </header>}
    {storageNotice && <div className="storage-error" role="alert">{storageNotice}</div>}
    {storageError && <div className="storage-error" role="alert"><span>{storageError}</span><button disabled={busy} onClick={() => loadError ? void init() : flush()}>再試行</button></div>}
    {!data ? <div className="loading" role="status">{loadError ? '読み込みエラー' : '読み込み中…'}</div> : manager === 'data' ? <DataManager getData={() => saver.data!} onImport={importData} onBusyChange={setBusy} /> : manager === 'memo' ? <FeatureMemo initial={data.featureMemo ?? ''} onDraft={featureMemo => textUpdate({ ...saver.data!, featureMemo })} onFlush={flush} /> : manager ? <Manager data={data} update={update} /> : !selected && view === 'ten-days' ? <TenDayList data={data} today={now} position={listPosition} onSelect={selectDate} /> : !selected ? <section className="calendar" aria-label="月間カレンダー">
      <div className="month-navigation"><div><span className="year-label">{month.year}</span><h2>{month.month + 1}<span>月</span></h2></div><div className="month-controls"><button className="today-button" onClick={() => { listPosition.current = null; setView('ten-days'); }}>予定一覧</button><button className="today-button" onClick={() => { setSlide(''); setMonth({ year: now.getFullYear(), month: now.getMonth() }); }}>今月</button><button className="icon-button" aria-label="メニュー" disabled={busy} onClick={openMenu}><Icon name="menu" /></button></div></div>
      <div className="calendar-swipe" {...swipeHandlers}><div className="weekday-grid">{weekdays.map((w, i) => <span key={w} className={`weekday-${i}`}>{w}</span>)}</div><div ref={gridRef} className="calendar-grid">{calendarDays(month.year, month.month).map((date, index) => { const key = dateKey(date), has = !!data.days[key]?.entries.length || !!data.days[key]?.title.trim(); return <button key={index} className={`calendar-day weekday-${(date.getDay() + 6) % 7} ${date.getMonth() !== month.month ? 'outside-month' : ''} ${key === today ? 'is-today' : ''}`} aria-label={`${key}${key === today ? ' 今日' : ''}${has ? ' 予定あり' : ''}`} onClick={() => selectDate(key)}><span className="day-number">{date.getDate()}</span><span className={`event-dot ${has ? 'visible' : ''}`} aria-hidden="true" /></button>; })}</div></div>
    </section> : <section className="day-detail" aria-label="日別予定">
      <div className="day-meta"><DayTitle key={selected} initial={day.title} onChange={title => textUpdate(setDay(saver.data!, selected, { title }))} onFlush={flush} /><button className="icon-button add-time" aria-label="時刻を追加" onClick={() => { flush(); setEditor({ mode: 'new', entry: { id: createId(), time: '', nextDay: false, freeTitle: '', titleId: null, elapsedTitle: '' } }); }}>＋</button></div>
      <div className="schedule-area">
        <div className="timeline">{timelineRows(day.entries).map(row => { const key = `${row.kind}:${row.entry.id}`; return <Fragment key={key}><div className={`timeline-row ${row.kind}-row`} data-entry-id={row.entry.id}>
          <span className="current-slot" aria-label={active === key ? '現在の予定' : undefined}>{active === key && <span className="current-icon">▶</span>}</span>
          {row.kind === 'time' ? <div className="entry-content"><button className="entry-time" aria-label={`${pointTime(row.entry)}を修正`} onClick={() => { flush(); setEditor({ mode: 'edit', entry: { ...saver.data!.days[selected].entries.find(e => e.id === row.entry.id)! } }); }}>{pointTime(row.entry)}</button><span className="entry-title" title={displayTitle(row.entry, data.titles)}>{displayTitle(row.entry, data.titles)}</span></div> : <ElapsedContent entry={row.entry} minutes={row.minutes} onDraft={value => textUpdate(setElapsedTitle(saver.data!, selected, row.entry.id, value))} onFlush={flush} />}
        </div></Fragment>; })}</div>
      </div>
      <MemoField key={selected} date={selected} initialValue={day.memo} onDraft={draftMemo} onFlush={flush} />
    </section>}
    {editor && data && selected && <EntryEditor key={editor.entry.id} state={editor} data={data} onCancel={() => setEditor(null)} onSave={async (entry, created) => {
      let next = saver.data!;
      for (const option of created) next = saveOption(next, option);
      await commitTimeChange(saveEntry(next, selected, entry));
    }} onDelete={async () => {
      if (editor.mode !== 'edit') return;
      await commitTimeChange(removeEntry(saver.data!, selected, editor.entry.id));
    }} />}
    {clearing && data && selected && <ClearDayConfirm date={selected} entries={clearing} now={now} onCancel={() => setClearing(null)} onConfirm={async () => {
      await commitTimeChange(clearEntries(saver.data!, selected)); setClearing(null);
    }} />}
    {menu && <Modal title={manualCopy !== null ? 'AI確認用コピー' : 'メニュー'} busy={copyBusy} onClose={() => setMenu(false)}>{manualCopy !== null ? <ManualCopy text={manualCopy} /> : <nav className="menu-items"><button disabled={copyBusy} onClick={() => { setManager('titles'); setMenu(false); setEditor(null); }}>予定タイトル一覧<Icon name="right" /></button><button disabled={copyBusy} onClick={() => { setManager('data'); setMenu(false); setEditor(null); }}>データ管理<Icon name="right" /></button>{selected && !manager && <button disabled={copyBusy} onClick={event => { void copyForAi(event.currentTarget.closest('section')!); }}>AI確認用コピー<Icon name="right" /></button>}{selected && !manager && <button className="danger" disabled={copyBusy} onClick={startClear}>この日の予定を全削除<Icon name="right" /></button>}<button disabled={copyBusy} onClick={() => { setManager('memo'); setMenu(false); setEditor(null); }}>メモ<Icon name="right" /></button></nav>}</Modal>}
    {copyNotice && <div className="copy-notice" role="status">{copyNotice}</div>}
  </main>;
}
