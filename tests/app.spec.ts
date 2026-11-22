import { test,expect,type Page } from '@playwright/test';
import { add,day,drag,exported,fixture,manage,open,stored,today } from './touch';
test.beforeEach(async({page})=>open(page));
test('2行の時刻入力と自由入力＋選択、自動整列、交互の経過時間行、320/390px表示',async({page})=>{
  await day(page);await add(page,'10:00','作業開始');await add(page,'08:00','起床');
  await page.getByRole('button',{name:'時刻を追加'}).click();await page.getByLabel('時刻',{exact:true}).fill('08:30');await page.getByLabel('自由入力タイトル').fill('朝の');
  const select=page.getByRole('combobox',{name:'タイトル選択'});await select.selectOption('title-1');await select.selectOption('');await expect(page.getByLabel('自由入力タイトル')).toHaveValue('朝の');await select.selectOption('title-1');expect(await select.getAttribute('multiple')).toBeNull();
  for(const width of [320,390]){await page.setViewportSize({width,height:740});const boxes=await page.locator('.editor-control-row').evaluate(el=>Array.from(el.children).map(c=>{const b=c.getBoundingClientRect();return b.y+b.height/2;}));expect(Math.max(...boxes)-Math.min(...boxes)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'test-results/input-320.png',fullPage:true});
  await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.entry-time')).toHaveText(['08:00','08:30','10:00']);await expect(page.locator('.time-row .entry-title')).toHaveText(['起床','朝の準備','作業開始']);await expect(page.locator('.elapsed-content')).toHaveText(['（30分）','（1時間30分）']);await expect(page.locator('.time-row .entry-duration,.timeline .drag-handle,.continuity')).toHaveCount(0);
  for(const width of [320,390]){await page.setViewportSize({width,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const columns=await page.locator('.time-row .entry-title').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().x));expect(new Set(columns).size).toBe(1);}
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'test-results/schedule-320.png',fullPage:true});
});
test('重複・未入力を拒否し、編集と翌日指定で再整列する',async({page})=>{
  await day(page);await page.getByRole('button',{name:'時刻を追加'}).click();await page.getByLabel('時刻',{exact:true}).fill('09:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.getByRole('alert')).toContainText('タイトル');await page.getByLabel('自由入力タイトル').fill('外出');await page.getByRole('button',{name:'決定'}).click();
  await add(page,'09:00','重複','',false,false);await expect(page.getByRole('alert')).toContainText('同じ時刻');await page.getByRole('checkbox',{name:'翌日'}).check();await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.entry-time')).toHaveText(['09:00','翌09:00']);await expect(page.locator('.elapsed-content')).toHaveText('（24時間）');
  await add(page,'08:00','','title-0');await page.locator('.time-row .entry-time').first().click();await page.getByLabel('時刻',{exact:true}).fill('10:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.entry-time')).toHaveText(['09:00','10:00','翌09:00']);
  await page.locator('.time-row .entry-time').nth(1).click();await page.getByLabel('時刻',{exact:true}).fill('09:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.getByRole('alert')).toContainText('同じ時刻');await page.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(page.locator('.entry-time')).toHaveText(['09:00','10:00','翌09:00']);
});
test('区間タイトルの自動保存、分割・削除確認・統合とIDに沿った保持',async({page})=>{
  await day(page);await add(page,'08:00','起床');await add(page,'09:00','出発');await page.locator('.elapsed-content').click();await page.getByLabel('経過時間タイトル').fill('準備');await page.locator('h1').click();await expect(page.locator('.elapsed-content')).toHaveText('準備（1時間）');
  await add(page,'08:30','着替え');await expect(page.locator('.elapsed-content')).toHaveText(['準備（30分）','（30分）']);await page.locator('.elapsed-content').nth(1).click();await page.getByLabel('経過時間タイトル').fill('後半');await page.locator('h1').click();
  await page.locator('.time-row .entry-time').nth(1).click();await page.getByRole('button',{name:'削除',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('経過時間タイトル「後半」も削除');await page.getByRole('dialog').getByRole('button',{name:'キャンセル'}).click();await expect(page.locator('.time-row')).toHaveCount(3);
  await page.getByRole('button',{name:'削除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.elapsed-content')).toHaveText('準備（1時間）');
  const id=(await stored(page)).days[today].entries.find(e=>e.time==='08:00')!.id;await page.locator('.time-row .entry-time').first().click();await page.getByLabel('時刻',{exact:true}).fill('10:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.entry-time')).toHaveText(['09:00','10:00']);expect((await stored(page)).days[today].entries.find(e=>e.id===id)!.elapsedTitle).toBe('準備');
  await page.locator('.time-row .entry-time').last().click();await page.getByLabel('時刻',{exact:true}).fill('08:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.elapsed-content')).toHaveText('準備（1時間）');
});
test('候補の追加・改名・削除・タッチ並べ替えと参照タイトルを維持する',async({page})=>{
  await day(page);await add(page,'08:00','朝の','title-1');await manage(page,'予定タイトル一覧');await page.getByRole('button',{name:'準備',exact:true}).click();await page.getByLabel('名前',{exact:true}).fill('支度');await page.getByRole('button',{name:'保存',exact:true}).click();await drag(page,1,0);await expect(page.locator('.option-row').first()).toHaveText('支度');
  await page.getByRole('button',{name:'支度を削除'}).click();await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();await page.getByRole('button',{name:'管理画面を閉じる'}).click();await expect(page.locator('.time-row .entry-title')).toHaveText('朝の支度');
  await page.getByRole('button',{name:'時刻を追加'}).click();await page.getByLabel('タイトル選択').selectOption('__add_option__');await page.getByLabel('新しいタイトル選択名').fill('集合');await page.getByRole('button',{name:'追加',exact:true}).click();await expect(page.getByLabel('タイトル選択')).not.toHaveValue('');await page.getByLabel('時刻',{exact:true}).fill('09:00');await page.getByRole('button',{name:'決定'}).click();await expect(page.locator('.time-row .entry-title')).toHaveText(['朝の支度','集合']);
});

test('追加カードは背景・キャンセル・Escで下書きを破棄し、内部操作では閉じない',async({page})=>{
  await day(page);const original=await stored(page);
  await expect(page.getByRole('button',{name:'＋ 時刻入力',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'時刻を追加'}).click();const card=page.getByRole('dialog',{name:'新規時刻入力'});
  await expect(card).toBeVisible();await expect(card.getByRole('button',{name:'削除',exact:true})).toHaveCount(0);await expect(page.locator('dialog[open]')).toHaveCount(1);await expect(page.locator('.day-detail')).toBeAttached();
  expect(await card.evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor)).toBe('rgba(29, 50, 44, 0.44)');
  await page.getByLabel('時刻',{exact:true}).fill('08:00');await page.getByLabel('自由入力タイトル').fill('中断する');await page.getByRole('checkbox',{name:'翌日'}).check();
  await card.locator('.modal-header h2').click();await expect(card).toBeVisible();expect(await stored(page)).toEqual(original);
  await page.mouse.click(2,2);await expect(card).toHaveCount(0);expect(await stored(page)).toEqual(original);
  await page.getByRole('button',{name:'時刻を追加'}).click();await expect(page.getByLabel('時刻',{exact:true})).toHaveValue('');await expect(page.getByRole('checkbox',{name:'翌日'})).not.toBeChecked();
  await page.getByLabel('自由入力タイトル').fill('キャンセルする');await page.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(card).toHaveCount(0);expect(await stored(page)).toEqual(original);
  await page.getByRole('button',{name:'時刻を追加'}).click();await page.getByLabel('タイトル選択').selectOption('__add_option__');await page.getByLabel('新しいタイトル選択名').fill('破棄する候補');await page.getByRole('button',{name:'追加',exact:true}).click();await page.keyboard.press('Escape');await expect(card).toHaveCount(0);expect(await stored(page)).toEqual(original);
});

test('時刻部分だけからIDに対応する修正カードを開き、中断時は元の予定を維持する',async({page})=>{
  await day(page);await add(page,'08:00','朝の','title-1');await add(page,'09:00','予定B','',true);const before=await stored(page);
  await page.locator('.time-row .entry-title').first().click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.elapsed-content').click();await page.getByLabel('経過時間タイトル').fill('区間の直接編集');await page.getByLabel('経過時間タイトル').press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);
  const updated=await stored(page);await page.getByRole('button',{name:'翌09:00を修正'}).click();const card=page.getByRole('dialog',{name:'時刻の修正'});await expect(card).toBeVisible();await expect(page.getByLabel('時刻',{exact:true})).toHaveValue('09:00');await expect(page.getByLabel('自由入力タイトル')).toHaveValue('予定B');await expect(page.getByLabel('タイトル選択')).toHaveValue('');await expect(page.getByRole('checkbox',{name:'翌日'})).toBeChecked();
  await page.getByLabel('時刻',{exact:true}).fill('07:00');await page.getByLabel('自由入力タイトル').fill('破棄');await page.getByRole('checkbox',{name:'翌日'}).uncheck();await page.mouse.click(2,2);expect(await stored(page)).toEqual(updated);
  await page.getByRole('button',{name:'08:00を修正'}).click();await expect(page.getByLabel('自由入力タイトル')).toHaveValue('朝の');await expect(page.getByLabel('タイトル選択')).toHaveValue('title-1');await page.getByLabel('時刻',{exact:true}).fill('10:00');await page.getByRole('button',{name:'キャンセル',exact:true}).click();expect((await stored(page)).days[today].entries.map(e=>e.time)).toEqual(before.days[today].entries.map(e=>e.time));
});

test('保存完了前は閉じず、保存失敗時はカード内にエラーを表示して元データを保持する',async({page})=>{
  await day(page);await add(page,'08:00','以前');const before=await stored(page);await page.getByRole('button',{name:'08:00を修正'}).click();
  await page.getByLabel('自由入力タイトル').fill('変更');await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value,key){if(fail&&key==='data'){fail=false;throw new DOMException('Full','QuotaExceededError');}return original.call(this,value,key);};});
  await page.getByRole('button',{name:'決定'}).click();await expect(page.getByRole('dialog',{name:'時刻の修正'})).toBeVisible();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('容量');expect(await stored(page)).toEqual(before);await page.getByRole('button',{name:'キャンセル',exact:true}).click();expect(await stored(page)).toEqual(before);
  await page.getByRole('button',{name:'08:00を修正'}).click();await expect(page.getByLabel('自由入力タイトル')).toHaveValue('以前');await page.getByLabel('自由入力タイトル').fill('保存した変更');await page.getByRole('button',{name:'決定'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await stored(page)).days[today].entries[0].freeTitle).toBe('保存した変更');
});

test('背景スクロールを抑止し、閉じた後に一覧位置を復元してメモを一覧末尾に置く',async({page})=>{
  await day(page);const data=(await stored(page))??{version:2,titles:[],days:{}};data.days[today]={title:'長い一覧',memo:'末尾のメモ',entries:Array.from({length:24},(_,i)=>({id:`point-${i}`,time:`${String(i).padStart(2,'0')}:00`,nextDay:false,freeTitle:`予定${i}`,titleId:null,elapsedTitle:''}))};await stored(page,data);await page.reload();await day(page);
  const order=await page.locator('.day-detail').evaluate(el=>Array.from(el.children).map(child=>child.className));expect(order).toEqual(['day-meta','schedule-area','day-memo']);
  await page.getByRole('button',{name:'12:00を修正'}).scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);expect(y).toBeGreaterThan(200);await page.getByRole('button',{name:'12:00を修正'}).click();const top=await page.locator('body').evaluate(el=>({position:el.style.position,top:el.style.top}));expect(top.position).toBe('fixed');expect(top.top).toBe(`-${y}px`);
  await page.mouse.move(2,2);await page.mouse.wheel(0,500);expect(await page.locator('body').evaluate(el=>el.style.top)).toBe(top.top);await page.keyboard.press('Escape');expect(await page.evaluate(()=>scrollY)).toBe(y);expect(await page.locator('body').evaluate(el=>el.style.position)).toBe('');
  await page.getByRole('button',{name:'12:00を修正'}).click();await page.getByRole('button',{name:'キャンセル',exact:true}).click();expect(await page.evaluate(()=>scrollY)).toBe(y);
});

test('小さな可視領域でもカード内をスクロールして決定・キャンセルを操作できる',async({page})=>{
  await day(page);await page.getByRole('button',{name:'時刻を追加'}).click();await page.getByLabel('時刻',{exact:true}).fill('08:00');await page.getByLabel('自由入力タイトル').fill('キーボード表示相当');await page.getByLabel('自由入力タイトル').focus();
  await page.setViewportSize({width:320,height:280});await page.getByLabel('タイトル選択').selectOption('__add_option__');await page.getByLabel('新しいタイトル選択名').fill('新候補');await page.getByRole('button',{name:'追加',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'追加',exact:true}).click();
  const card=page.getByRole('dialog',{name:'新規時刻入力'}),box=await card.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(280);expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'決定'}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'決定'}).click();await expect(card).toHaveCount(0);await expect(page.locator('.time-row .entry-title')).toHaveText('キーボード表示相当新候補');
  await page.getByRole('button',{name:'08:00を修正'}).click();await page.getByRole('button',{name:'キャンセル',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('AI確認用コピーは日別画面のメニューだけに表示し、既存の画面配置を変えない',async({page})=>{
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'AI確認用コピー',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'予定タイトル一覧',exact:true})).toBeVisible();await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'予定一覧',exact:true}).click();await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'AI確認用コピー',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:/11月6日/}).click();await expect(page.locator('.day-meta button')).toHaveCount(1);await expect(page.locator('.day-meta button')).toHaveAccessibleName('時刻を追加');await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'AI確認用コピー',exact:true})).toBeVisible();await page.getByRole('button',{name:'予定タイトル一覧',exact:true}).click();
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'AI確認用コピー',exact:true})).toHaveCount(0);
});

test('AIコピーは表示順・結合タイトル・空の区間・実翌日を出力し、秘密欄や保存データを変更しない',async({page,context})=>{
  const external:string[]=[];context.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await day(page);await add(page,'23:00','夜の','title-2');await add(page,'01:30','到着','',true);await add(page,'08:00','朝の','title-1');await page.locator('.elapsed-content').last().click();await page.getByLabel('経過時間タイトル').fill('深夜移動');await page.getByLabel('経過時間タイトル').press('Enter');
  await page.getByLabel('日付タイトル').fill('コピー禁止の日付タイトル');await page.getByLabel('メモ').fill('コピー禁止のメモ内容');await page.getByRole('button',{name:'メニュー',exact:true}).click();const before=await stored(page);
  await page.evaluate(()=>{
    const state=window as any;state.copyWrites=0;const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){state.copyWrites++;return original.call(this,value,key);};
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(text:string)=>{state.copiedText=text;return new Promise<void>(resolve=>{state.finishCopy=resolve;});}}});
  });
  await page.getByRole('button',{name:'AI確認用コピー',exact:true}).click();await expect(page.getByRole('button',{name:'AI確認用コピー',exact:true})).toBeDisabled();await expect(page.getByText('コピーしました',{exact:true})).toHaveCount(0);await page.evaluate(()=>(window as any).finishCopy());await expect(page.getByRole('status')).toHaveText('コピーしました');
  const text=await page.evaluate(()=>(window as any).copiedText as string);
  expect(text.split('\n\n---\n\n')[0]).toBe('2026年11月6日（金）\n\n08:00　朝の準備\n（15時間）\n23:00　夜の作業\n深夜移動（2時間30分）\n翌01:30［11月7日（土）］　到着');
  expect(text).toContain('\n\n---\n\n【AIへの最終確認依頼】');expect(text).toContain('公式時刻表');expect(text).toContain('予定日に実際に運行される列車・バスか。');expect(text).toContain('【未確認・情報不足の項目】');expect(text).not.toMatch(/コピー禁止|title-\d/);for(const entry of before.days[today].entries)expect(text).not.toContain(entry.id);
  expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>(window as any).copyWrites)).toBe(0);expect(external).toEqual([]);await page.clock.runFor(3001);await expect(page.getByText('コピーしました',{exact:true})).toHaveCount(0);
});

test('Clipboard API拒否時はメニュー内の互換コピーを試し、成功を通知する',async({page})=>{
  await day(page);await add(page,'09:00','出発');const before=await stored(page);
  await page.evaluate(()=>{const state=window as any;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});document.execCommand=(command:string)=>{const field=document.activeElement as HTMLTextAreaElement;state.legacyCommand=command;state.legacyText=field.value;state.legacyInside=!!field.closest('dialog[open]');return true;};});
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name:'AI確認用コピー',exact:true}).click();await expect(page.getByRole('status')).toHaveText('コピーしました');expect(await page.evaluate(()=>(window as any).legacyCommand)).toBe('copy');expect(await page.evaluate(()=>(window as any).legacyInside)).toBe(true);expect(await page.evaluate(()=>(window as any).legacyText)).toContain('09:00　出発');await expect(page.getByLabel('AI確認用テキスト')).toHaveCount(0);expect(await stored(page)).toEqual(before);
});

test('自動コピー不可なら全文を選択できる手動画面を表示し、成功と誤通知しない',async({page})=>{
  await day(page);await add(page,'08:00','予定');const before=await stored(page);await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=()=>false;});
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name:'AI確認用コピー',exact:true}).click();const card=page.getByRole('dialog',{name:'AI確認用コピー',exact:true}),field=page.getByLabel('AI確認用テキスト');await expect(card).toBeVisible();await expect(card).toContainText('自動コピーできませんでした。');await expect(page.getByText('コピーしました',{exact:true})).toHaveCount(0);await expect(page.locator('dialog[open]')).toHaveCount(1);
  const text=await field.inputValue();expect(text).toContain('2026年11月6日（金）\n\n08:00　予定');expect(text).toContain('【AIへの最終確認依頼】');await expect(field).toHaveAttribute('readonly','');await page.getByRole('button',{name:'すべて選択',exact:true}).click();expect(await field.evaluate(el=>(el as HTMLTextAreaElement).selectionEnd-(el as HTMLTextAreaElement).selectionStart)).toBe(text.length);expect(await stored(page)).toEqual(before);
  expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'test-results/manual-copy-320.png'});await page.keyboard.press('Escape');await expect(card).toHaveCount(0);await expect(page.locator('.day-detail')).toBeVisible();
});

test('空予定では既存クリップボードを変更せず、依頼文だけのコピーもしない',async({page})=>{
  await day(page);await page.getByLabel('日付タイトル').fill('タイトルだけ');await page.getByLabel('メモ').fill('メモだけ');await page.getByRole('button',{name:'メニュー',exact:true}).click();const before=await stored(page);
  await page.evaluate(()=>{const state=window as any;state.clipboardValue='既存クリップボード';state.copyCalls=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{state.copyCalls++;state.clipboardValue=text;}}});document.execCommand=()=>{state.copyCalls++;return true;};});
  await page.getByRole('button',{name:'AI確認用コピー',exact:true}).click();await expect(page.getByRole('status')).toHaveText('予定がありません');expect(await page.evaluate(()=>(window as any).copyCalls)).toBe(0);expect(await page.evaluate(()=>(window as any).clipboardValue)).toBe('既存クリップボード');expect(await stored(page)).toEqual(before);await expect(page.getByLabel('AI確認用テキスト')).toHaveCount(0);
});

test('経過時間入力の4辺の緑枠と寸法・長文編集・保存を維持する',async({page},info)=>{
  const data=fixture();data.days[today].entries=[
    {id:'a',time:'09:20',nextDay:false,freeTitle:'出発',titleId:null,elapsedTitle:'車移動'},
    {id:'b',time:'10:20',nextDay:false,freeTitle:'コインパーキング到着',titleId:null,elapsedTitle:''},
  ];
  await stored(page,data);await page.reload();await day(page);
  const field=page.getByLabel('経過時間タイトル'),longTitle='長い経過時間タイトル'.repeat(30);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:740});await page.locator('button.elapsed-content').tap();await expect(field).toBeFocused();
    await expect(field).toHaveCSS('outline-color','rgb(74, 125, 97)');await expect(field).toHaveCSS('outline-width','2px');await expect(field).toHaveCSS('outline-style','solid');await expect(field).toHaveCSS('outline-offset','-2px');
    const geometry=()=>field.evaluate(el=>{
      const parent=el.parentElement!,duration=parent.querySelector('.entry-duration')!;
      const box=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      return {input:box(el),parent:box(parent),duration:box(duration)};
    });
    const before=await geometry();expect(before.input.x).toBe(before.parent.x);
    // The previous outline setting must have exactly the same layout geometry.
    await field.evaluate(el=>el.style.outlineOffset='3px');expect(await geometry()).toEqual(before);await field.evaluate(el=>el.style.removeProperty('outline-offset'));
    await page.locator('.elapsed-row').screenshot({path:info.outputPath(`elapsed-focus-${width}.png`)});
    await field.fill(longTitle);expect(await geometry()).toEqual(before);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await field.locator('..').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await field.press('Enter');await expect(page.locator('button.elapsed-content')).toHaveText(`${longTitle}（1時間）`);
    expect(await page.locator('.elapsed-content .entry-title').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  }
  const expected=structuredClone(data);expected.days[today].entries[0].elapsedTitle=longTitle;expect(await stored(page)).toEqual(expected);
  await page.getByLabel('日付タイトル').focus();await expect(page.getByLabel('日付タイトル')).toHaveCSS('outline-offset','3px');
  await page.getByLabel('メモ').focus();await expect(page.getByLabel('メモ')).toHaveCSS('outline-offset','3px');
  await page.reload();await day(page);await expect(page.locator('button.elapsed-content')).toHaveText(`${longTitle}（1時間）`);
});

test('カレンダーの点は時刻または空白以外の日付タイトルで表示し、即時更新と入出力で保持する',async({page},info)=>{
  const data=fixture();data.days['2026-11-02']={title:'  過去の日付タイトル　',memo:'',entries:[]};
  data.days['2026-11-03']={title:'',memo:'メモだけ',entries:[]};
  data.days['2026-11-04']={title:' \t　\u00a0 ',memo:'',entries:[]};
  data.days['2026-11-05']={title:'',memo:'',entries:[{id:'c',time:'09:00',nextDay:false,freeTitle:'時刻のみ',titleId:null,elapsedTitle:''}]};
  await stored(page,data);await page.reload();
  const indicator=async(key:string,visible:boolean)=>{
    const button=page.getByRole('button',{name:new RegExp(`^${key}`)});
    await expect(button.locator('.event-dot')).toHaveCSS('visibility',visible?'visible':'hidden');
    expect((await button.getAttribute('aria-label'))!.includes('予定あり')).toBe(visible);
  };
  for(const [key,visible] of [['2026-11-02',true],['2026-11-03',false],['2026-11-04',false],['2026-11-05',true],[today,true],['2026-11-07',false]] as const)await indicator(key,visible);
  expect(await stored(page)).toEqual(data);
  await day(page,'2026-11-07');await page.getByLabel('日付タイトル').fill('  新しいタイトル　');await page.getByRole('button',{name:'カレンダーに戻る'}).click();await indicator('2026-11-07',true);
  expect((await stored(page)).days['2026-11-07'].title).toBe('  新しいタイトル　');
  for(const title of ['', ' \t　 ']){
    await day(page,'2026-11-07');await page.getByLabel('日付タイトル').fill(title);await page.getByRole('button',{name:'カレンダーに戻る'}).click();await indicator('2026-11-07',false);
  }
  await day(page,'2026-11-07');await add(page,'08:00','追加した時刻');await page.getByRole('button',{name:'カレンダーに戻る'}).click();await indicator('2026-11-07',true);
  await day(page,'2026-11-07');await page.getByRole('button',{name:'08:00を修正'}).click();await page.getByRole('button',{name:'削除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();
  await page.getByRole('button',{name:'カレンダーに戻る'}).click();await indicator('2026-11-07',false);
  await day(page);await page.getByLabel('日付タイトル').fill('');await page.getByRole('button',{name:'カレンダーに戻る'}).click();await indicator(today,true);
  const saved=await stored(page);expect(saved.days[today]).toEqual({...data.days[today],title:''});expect(saved.days['2026-11-02']).toEqual(data.days['2026-11-02']);
  await manage(page);const backup=await exported(page,info.outputPath('calendar-backup.json'));expect(backup.data).toEqual(saved);
  await page.getByLabel('バックアップJSON').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.getByRole('button',{name:'置き換えて復元'}).click();
  await indicator('2026-11-02',true);await indicator('2026-11-03',false);await indicator('2026-11-04',false);await indicator('2026-11-05',true);await indicator(today,true);await indicator('2026-11-07',false);
  expect(await stored(page)).toEqual(saved);
});

const menuOrder=['予定タイトル一覧','データ管理','AI確認用コピー','この日の予定を全削除','機能追加用メモ'];
const menuItems=(page:Page)=>page.locator('.menu-items button').allTextContents();
test('全削除は日別画面のメニューだけに赤字で表示し、時刻がない日は「削除する予定がありません」と表示する',async({page})=>{
  await page.getByRole('button',{name:'メニュー',exact:true}).click();expect(await menuItems(page)).toEqual(['予定タイトル一覧','データ管理','機能追加用メモ']);await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'予定一覧',exact:true}).click();await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'この日の予定を全削除'})).toHaveCount(0);await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:/11月7日/}).click();await page.getByLabel('日付タイトル').fill('タイトルだけ');await page.getByLabel('メモ').fill('メモだけ');await page.getByRole('button',{name:'メニュー',exact:true}).click();
  expect(await menuItems(page)).toEqual(menuOrder);
  const button=page.getByRole('button',{name:'この日の予定を全削除',exact:true});expect(await button.evaluate(el=>getComputedStyle(el).color)).toBe('rgb(170, 81, 74)');
  const before=await stored(page);await button.click();
  await expect(page.getByRole('status')).toHaveText('削除する予定がありません');await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await stored(page)).toEqual(before);
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name:'機能追加用メモ',exact:true}).click();await page.getByRole('button',{name:'メニュー',exact:true}).click();await expect(page.getByRole('button',{name:'この日の予定を全削除'})).toHaveCount(0);
});

test('全削除は確認画面で件数を示し、キャンセルでは消さず、保存失敗時は残し、削除後は再起動しても空のまま',async({browser},info)=>{
  const profile=info.outputPath('profile'),browserType=browser.browserType();
  const launch=async()=>{const context=await browserType.launchPersistentContext(profile,{headless:true,offline:true,viewport:{width:320,height:740},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo',args:['--disable-breakpad','--disable-crash-reporter',`--crash-dumps-dir=${info.outputPath('crashes')}`]});const page=context.pages()[0];await open(page);return {context,page};};
  let {context,page}=await launch();
  const data=fixture();data.days['2026-11-07']={title:'翌日',memo:'翌日のメモ',entries:[{id:'c',time:'09:00',nextDay:false,freeTitle:'別の日',titleId:null,elapsedTitle:'別の区間'}]};data.featureMemo='改善案';
  await stored(page,data);await page.reload();await day(page);
  const openConfirm=async()=>{await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name:'この日の予定を全削除',exact:true}).click();return page.getByRole('dialog',{name:'予定を全削除',exact:true});};
  let dialog=await openConfirm();
  await expect(dialog.locator('.confirm-text')).toHaveText('11月6日（金）の時刻2件と、経過時間タイトル1件を削除します。日付タイトルとメモは残ります。');
  await expect(dialog.getByRole('button')).toHaveText(['','キャンセル','削除']);expect(await dialog.getByRole('button',{name:'削除',exact:true}).evaluate(el=>el.className)).toBe('danger-fill');
  await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.time-row')).toHaveCount(2);expect(await stored(page)).toEqual(data);
  dialog=await openConfirm();
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value,key){if(fail&&key==='data'){fail=false;throw new DOMException('Full','QuotaExceededError');}return original.call(this,value,key);};});
  await dialog.getByRole('button',{name:'削除',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('容量');expect(await stored(page)).toEqual(data);await expect(page.locator('.time-row')).toHaveCount(2);
  await dialog.getByRole('button',{name:'削除',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.time-row,.elapsed-row')).toHaveCount(0);await expect(page.getByLabel('日付タイトル')).toHaveValue('通常日');await expect(page.getByLabel('メモ')).toHaveValue(data.days[today].memo);
  const expected={...data,days:{...data.days,[today]:{...data.days[today],entries:[]}}};expect(await stored(page)).toEqual(expected);
  await context.close();({context,page}=await launch());
  await day(page);await expect(page.locator('.time-row,.elapsed-row')).toHaveCount(0);await expect(page.getByLabel('日付タイトル')).toHaveValue('通常日');expect(await stored(page)).toEqual(expected);
  await context.close();
});

test('全削除の確認画面は年が違う日に年を付け、経過時間タイトル0件は表示せず、320/390/412pxで崩れない',async({page})=>{
  const data=fixture();data.days['2025-11-06']={title:'',memo:'',entries:[{id:'old',time:'08:00',nextDay:false,freeTitle:'去年の予定',titleId:null,elapsedTitle:''}]};await stored(page,data);await page.reload();
  for(let i=0;i<12;i++)await page.getByRole('button',{name:'前月',exact:true}).click();
  await day(page,'2025-11-06');
  for(const width of [320,390,412]){
    await page.setViewportSize({width,height:740});
    await page.getByRole('button',{name:'メニュー',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'この日の予定を全削除',exact:true}).click();const dialog=page.getByRole('dialog',{name:'予定を全削除',exact:true});
    await expect(dialog.locator('.confirm-text')).toHaveText('2025年11月6日（木）の時刻1件を削除します。日付タイトルとメモは残ります。');
    const layout=await dialog.evaluate(el=>{const box=el.querySelector('section')!.getBoundingClientRect(),buttons=[...el.querySelectorAll('.confirm-actions button')].map(b=>b.getBoundingClientRect());return{left:box.left,right:box.right,overflow:el.scrollWidth>el.clientWidth,rowY:new Set(buttons.map(b=>Math.round(b.top))).size,inside:buttons.every(b=>b.left>=box.left&&b.right<=box.right)};});
    expect(layout.left).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(width);expect(layout.overflow).toBe(false);expect(layout.rowY).toBe(1);expect(layout.inside).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await dialog.getByRole('button',{name:'キャンセル',exact:true}).click();
  }
  expect(await stored(page)).toEqual(data);
});
