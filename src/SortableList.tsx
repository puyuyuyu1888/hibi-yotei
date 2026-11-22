import { useRef, useState, type ReactNode } from 'react';
import { moveItem } from './model';

type Props<T> = { items: T[]; onChange: (items: T[]) => void; render: (item: T) => ReactNode; label: (item: T) => string };
export function SortableList<T extends { id: string }>({ items, onChange, render, label }: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; target: string; y: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const finish = (cancel: boolean) => {
    if (!cancel && drag.current) onChange(moveItem(items, drag.current.id, drag.current.target));
    drag.current = null; setActive(null); setTarget(null);
  };
  return <div className="sortable-list" ref={root}>
    {items.map((item, index) => <div key={item.id} data-sort-id={item.id}
      className={`sort-row ${active === item.id ? 'drag-active' : ''} ${target === item.id && active !== item.id ? 'drop-target' : ''}`}>
      {render(item)}
      <button type="button" className="drag-handle icon-button" aria-label={`${label(item)}を並べ替え`}
        aria-pressed={active === item.id}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: item.id, target: item.id, y: event.clientY }; setActive(item.id);
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const rows = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-sort-id]') ?? []);
          const row = rows.find(r => { const box = r.getBoundingClientRect(); return event.clientY >= box.top && event.clientY <= box.bottom; });
          if (row?.dataset.sortId) { drag.current.target = row.dataset.sortId; setTarget(row.dataset.sortId); }
          if (event.clientY < 90) window.scrollBy(0, -16);
          if (event.clientY > window.innerHeight - 75) window.scrollBy(0, 16);
        }}
        onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => { if (drag.current) finish(true); }}
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const next = items[index + (event.key === 'ArrowUp' ? -1 : 1)];
          if (next) onChange(moveItem(items, item.id, next.id));
        }}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg></button>
    </div>)}
  </div>;
}
