import { memo, useLayoutEffect, useRef, useState } from 'react';

type Props = { date: string; initialValue: string; onDraft: (date: string, text: string) => void; onFlush: () => void };
export const MemoField = memo(function MemoField({ date, initialValue, onDraft, onFlush }: Props) {
  const [value, setValue] = useState(initialValue);
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      const el = field.current!;
      const top = el.scrollTop;
      el.style.height = '0px';
      el.style.height = `${Math.min(320, Math.max(88, el.scrollHeight))}px`;
      el.scrollTop = document.activeElement === el && el.selectionEnd === el.value.length ? el.scrollHeight : top;
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);
  return <textarea ref={field} className="day-memo" aria-label="メモ" rows={3} value={value} onChange={e => {
    const text = e.target.value; setValue(text); onDraft(date, text);
  }} onBlur={onFlush} />;
});
