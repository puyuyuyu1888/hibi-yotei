import { useLayoutEffect, useRef, type ReactNode } from 'react';

type Props = { children: ReactNode; title: string; onClose: () => void; busy?: boolean; className?: string };
export function Modal({ children, title, onClose, busy = false, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const outsideStart = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current!, body = document.body, root = document.documentElement;
    const x = window.scrollX, y = window.scrollY, opener = document.activeElement as HTMLElement | null;
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: root.style.overflow };
    body.style.position = 'fixed'; body.style.top = `-${y}px`; body.style.left = `-${x}px`; body.style.width = '100%'; root.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const resize = () => {
      el.style.setProperty('--modal-height', `${viewport?.height ?? window.innerHeight}px`);
      el.style.setProperty('--modal-center-y', `${(viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) / 2}px`);
    };
    resize(); el.showModal();
    viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize);
      el.close();
      body.style.position = previous.position; body.style.top = previous.top; body.style.left = previous.left; body.style.width = previous.width; root.style.overflow = previous.overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      window.scrollTo(x, y);
    };
  }, []);
  return <dialog className={`modal ${className}`} ref={ref} aria-label={title}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onPointerDown={event => {
      const box = event.currentTarget.getBoundingClientRect();
      outsideStart.current = event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    }}
    onClick={event => { if (outsideStart.current && event.target === event.currentTarget && !busy) onClose(); outsideStart.current = false; }}>
    <section onClick={event => event.stopPropagation()}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose} disabled={busy}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
      {children}
    </section>
  </dialog>;
}
