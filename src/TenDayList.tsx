import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { dateKey, parseDate, type Data } from './model';

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
// This is a moving window, not a limit on the dates that can be visited.
const radius = 90, rowCount = radius * 2 + 1, edge = 30;
export type ListPosition = { date: string; offset: number };
function shiftDate(key: string, days: number): string {
  const date = parseDate(key); date.setDate(date.getDate() + days); return dateKey(date);
}
export function TenDayList({ data, today, position, onSelect }: {
  data: Data; today: Date; position: RefObject<ListPosition | null>; onSelect: (date: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const initial = useRef(position.current ?? { date: dateKey(today), offset: 0 });
  const pending = useRef<ListPosition | null>(initial.current);
  const [start, setStart] = useState(() => shiftDate(initial.current.date, -radius));
  const dates = useMemo(() => Array.from({ length: rowCount }, (_, i) => parseDate(shiftDate(start, i))), [start]);
  const measure = () => {
    const el = list.current!, rows = el.querySelectorAll<HTMLElement>('.ten-day-row');
    const height = rows[0].getBoundingClientRect().height;
    if (!height) return null;
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor(el.scrollTop / height)));
    return { index, date: rows[index].dataset.date!, offset: el.scrollTop - index * height };
  };
  useLayoutEffect(() => {
    const el = list.current!;
    const restore = () => {
      const anchor = pending.current ?? position.current ?? initial.current;
      const row = el.querySelector<HTMLElement>(`[data-date="${anchor.date}"]`);
      if (!row) return;
      const padding = parseFloat(getComputedStyle(el).paddingTop) || 0;
      el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - padding + anchor.offset;
      position.current = anchor; pending.current = null;
    };
    const resize = () => {
      // Keep the existing header, row geometry and bottom space; only the list scrolls.
      const shell = el.closest('.app-shell');
      const bottom = shell ? parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 0;
      el.style.height = `${Math.max(1, window.innerHeight - el.getBoundingClientRect().top - bottom)}px`;
      restore();
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    const header = el.closest('.app-shell')?.querySelector('.app-header');
    if (header) observer?.observe(header);
    window.addEventListener('resize', resize);
    return () => {
      const anchor = measure();
      if (anchor && !pending.current) position.current = { date: anchor.date, offset: anchor.offset };
      observer?.disconnect(); window.removeEventListener('resize', resize);
    };
  }, [start, position]);
  const scroll = () => {
    if (pending.current) return;
    const anchor = measure();
    if (!anchor) return;
    position.current = { date: anchor.date, offset: anchor.offset };
    const visible = Math.ceil(list.current!.clientHeight / list.current!.firstElementChild!.getBoundingClientRect().height);
    if (anchor.index < edge || anchor.index + visible >= rowCount - edge) {
      pending.current = position.current;
      setStart(shiftDate(anchor.date, -radius));
    }
  };
  return <section className="ten-day-list" aria-label="予定一覧"><div ref={list} className="date-scroll" onScroll={scroll}>
    {dates.map(date => {
      const key = dateKey(date), day = data.days[key], isToday = key === dateKey(today);
      const label = `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
      return <article className={`ten-day-row${isToday ? ' is-today' : ''}`} data-date={key} key={key}>
        <button className="ten-day-heading" onClick={() => onSelect(key)} aria-label={isToday ? `${label} 今日${day?.title ? ` ${day.title}` : ''}` : undefined}>
          <span className={`ten-day-date weekday-${(date.getDay() + 6) % 7}`}>{label}</span>
          {day?.title && <span className="ten-day-title" title={day.title}>{day.title}</span>}
        </button>
      </article>;
    })}
  </div></section>;
}
