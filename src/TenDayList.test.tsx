import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { TenDayList } from './TenDayList';
import type { ListPosition } from './TenDayList';
import { initialData, saveEntry, setDay } from './model';
afterEach(cleanup);
it('今日の前後の日付と日付タイトルだけを表示し、日付を開き、元データを維持する',()=>{
  const data=setDay(saveEntry(initialData(),'2026-11-06',{id:'a',time:'08:00',nextDay:false,freeTitle:'非表示タイトル',titleId:null,elapsedTitle:'非表示区間'}),'2026-11-06',{title:'通常日',memo:'非表示メモ'}),onSelect=vi.fn();const before=JSON.stringify(data);
  const position=createRef<ListPosition|null>();
  const {container,rerender}=render(<TenDayList data={data} today={new Date(2026,10,6)} position={position} onSelect={onSelect}/>);
  expect(container.querySelectorAll('.ten-day-row')).toHaveLength(181);expect(container.textContent).toContain('11月6日（金）今日通常日');expect(container.textContent).not.toMatch(/非表示|08:00/);
  fireEvent.click(screen.getByRole('button',{name:'11月7日（土）'}));expect(onSelect).toHaveBeenCalledWith('2026-11-07');expect(JSON.stringify(data)).toBe(before);
  const first=container.querySelector('.ten-day-row')?.getAttribute('data-date');
  rerender(<TenDayList data={data} today={new Date(2026,10,7)} position={position} onSelect={onSelect}/>);expect(container.querySelector('.ten-day-row')?.getAttribute('data-date')).toBe(first);
});
it('年越し・うるう日・空の日付を連続して生成する',()=>{
  const position=createRef<ListPosition|null>();
  const {container}=render(<TenDayList data={initialData()} today={new Date(2024,0,1)} position={position} onSelect={()=>{}}/>);
  expect(container.querySelector('[data-date="2023-12-31"]')?.textContent).toBe('12月31日（日）');
  expect(container.querySelector('[data-date="2024-01-01"]')?.textContent).toBe('1月1日（月）今日');
  expect(container.querySelector('[data-date="2024-02-29"]')?.textContent).toBe('2月29日（木）');
  expect(container.querySelector('[data-date="2024-03-01"]')?.textContent).toBe('3月1日（金）');
});
it('復元する日付を基準に範囲を生成する',()=>{
  const position=createRef<ListPosition|null>();position.current={date:'2012-02-29',offset:17.5};
  const {container}=render(<TenDayList data={initialData()} today={new Date(2026,10,6)} position={position} onSelect={()=>{}}/>);
  expect(container.querySelectorAll('.ten-day-row')[90].getAttribute('data-date')).toBe('2012-02-29');
});
it('今日の行だけを強調し、日付が変わると強調する行を切り替える',()=>{
  const data=setDay(initialData(),'2026-11-22',{title:'今日の予定'}),position=createRef<ListPosition|null>(),onSelect=vi.fn();
  const {container,rerender}=render(<TenDayList data={data} today={new Date(2026,10,22,23,59,59)} position={position} onSelect={onSelect}/>);
  expect([...container.querySelectorAll('.ten-day-row.is-today')].map(e=>e.getAttribute('data-date'))).toEqual(['2026-11-22']);
  expect(container.querySelectorAll('.today-badge')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'11月22日（日） 今日 今日の予定'}));expect(onSelect).toHaveBeenCalledWith('2026-11-22');
  rerender(<TenDayList data={data} today={new Date(2026,10,23,0,0,0)} position={position} onSelect={onSelect}/>);
  expect([...container.querySelectorAll('.ten-day-row.is-today')].map(e=>e.getAttribute('data-date'))).toEqual(['2026-11-23']);
  expect(screen.getByRole('button',{name:'11月23日（月） 今日'})).toBeTruthy();
});
