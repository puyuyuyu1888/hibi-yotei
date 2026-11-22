import { expect, it } from 'vitest';
import { currentTimelineRow, formatElapsed, timelineRows } from './timeline';
import type { Entry } from './model';
const e = (id: string, time: string, nextDay=false): Entry => ({id,time,nextDay,freeTitle:id,titleId:null,elapsedTitle:''});
it.each([[0,'0分'],[15,'15分'],[30,'30分'],[45,'45分'],[60,'1時間'],[75,'1時間15分'],[90,'1時間30分'],[120,'2時間'],[150,'2時間30分'],[180,'3時間'],[1440,'24時間'],[1530,'25時間30分']])('経過時間 %i → %s',(n,s)=>expect(formatElapsed(n as number)).toBe(s));
it('負の時間を拒否する',()=>expect(()=>formatElapsed(-1)).toThrow());
it('0・1件では区間なし、ソートして交互に仮想行を生成する',()=>{
  expect(timelineRows([])).toEqual([]); expect(timelineRows([e('a','08:00')])).toHaveLength(1);
  const entries=[e('c','10:00'),e('a','08:00'),e('b','08:30')], before=JSON.stringify(entries), rows=timelineRows(entries);
  expect(rows.map(r=>r.kind)).toEqual(['time','elapsed','time','elapsed','time']);
  expect(rows.filter(r=>r.kind==='elapsed').map(r=>[r.entry.id,r.minutes])).toEqual([['a',30],['b',90]]); expect(JSON.stringify(entries)).toBe(before);
});
it('明示的な翌日のみ加算し、翌日の現在表示には混ぜない',()=>{
  const entries=[e('a','23:00'),e('b','02:00',true)];
  expect(timelineRows(entries)[1]).toMatchObject({kind:'elapsed',minutes:180});
  expect(currentTimelineRow('2026-11-06',entries,new Date(2026,10,6,23,0))).toBe('time:a');
  expect(currentTimelineRow('2026-11-06',entries,new Date(2026,10,6,23,30))).toBe('elapsed:a');
  expect(currentTimelineRow('2026-11-06',entries,new Date(2026,10,7,1,0))).toBeUndefined();
});
