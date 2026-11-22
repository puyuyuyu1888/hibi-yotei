import { afterEach, expect, it, vi } from 'vitest';
import { AI_REVIEW_REQUEST, buildAiReview, copyReviewText } from './aiCopy';
import { initialData, type Entry } from './model';

const point = (id: string, time: string, freeTitle: string, nextDay = false, elapsedTitle = ''): Entry => ({ id, time, freeTitle, nextDay, elapsedTitle, titleId: null });
const originalExec = Object.getOwnPropertyDescriptor(document, 'execCommand');
afterEach(() => {
  vi.unstubAllGlobals(); document.body.replaceChildren();
  if (originalExec) Object.defineProperty(document, 'execCommand', originalExec); else delete (document as any).execCommand;
});
function exec(result: boolean | Error, inspect?: () => void) {
  const fn = vi.fn(() => { inspect?.(); if (result instanceof Error) throw result; return result; });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: fn }); return fn;
}

it('表示と同じ時刻順・結合タイトル・空の経過タイトルを使い、全角空白と固定依頼文を付ける', () => {
  const entries = [point('last-private-id', '10:00', '到着'), { ...point('first-private-id', '08:00', '朝の', false, '準備'), titleId: 'title-0' }, point('middle-private-id', '09:00', '出発')];
  const before = JSON.stringify(entries), text = buildAiReview('2026-11-09', entries, initialData().titles)!;
  expect(text).toBe(`2026年11月9日（月）\n\n08:00　朝の起床\n準備（1時間）\n09:00　出発\n（1時間）\n10:00　到着\n\n---\n\n${AI_REVIEW_REQUEST}`);
  expect(text).not.toMatch(/private-id|title-0|<[^>]*>/); expect(JSON.stringify(entries)).toBe(before);
});
it('1件は時刻行だけ、0件は依頼文も生成しない', () => {
  expect(buildAiReview('2026-11-09', [], [])).toBeNull();
  expect(buildAiReview('2026-11-09', [point('a', '08:00', '起床', false, '表示しない区間')], [])?.split('\n\n---\n\n')[0]).toBe('2026年11月9日（月）\n\n08:00　起床');
});
it('日付またぎの実日付と1時間30分形式を出力する', () => {
  const text = buildAiReview('2026-11-09', [point('b', '00:30', '到着', true), point('a', '23:00', '出発', false, '移動')], [])!;
  expect(text.split('\n\n---\n\n')[0]).toBe('2026年11月9日（月）\n\n23:00　出発\n移動（1時間30分）\n翌00:30［11月10日（火）］　到着');
});
it.each([
  ['2026-11-30', '12月1日（火）'], ['2026-12-31', '2027年1月1日（金）'],
  ['2024-02-28', '2月29日（木）'], ['2024-02-29', '3月1日（金）'], ['2026-02-28', '3月1日（日）'],
])('月末・年末・うるう年 %s', (date, next) => expect(buildAiReview(date, [point('a', '01:00', '翌日', true)], [])).toContain(`翌01:00［${next}］　翌日`));
it('削除済み候補の名前も表示と同じように扱う', () => expect(buildAiReview('2026-11-09', [{ ...point('a', '08:00', '朝の'), titleId: 'removed' }], [{ id: 'removed', name: '準備', deleted: true }])).toContain('08:00　朝の準備'));
it('固定依頼文の確認事項10件、調査方法、情報不足、回答形式を含む', () => {
  expect(AI_REVIEW_REQUEST).toMatch(/^【AIへの最終確認依頼】\n\n/);
  expect(AI_REVIEW_REQUEST.match(/^\d+\. /gm)).toHaveLength(10);
  for (const text of ['### 確認事項', '### 調査方法', '### 情報不足の場合', '### 回答形式', '平日・土休日・祝日のダイヤ', '公式時刻表', '対象の日付に適用される運行カレンダー', '情報源のURL', '時刻だけから特定の列車やバスを勝手に断定しないでください。', '【確認できた項目】', '【修正が必要な項目】', '【未確認・情報不足の項目】']) expect(AI_REVIEW_REQUEST).toContain(text);
  expect(AI_REVIEW_REQUEST).toMatch(/確認できていない事項を、問題がないと断定しないでください。$/);
});
it('Clipboard APIの成功時だけ成功とし、互換手段を重ねて実行しない', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined), legacy = exec(true);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  expect(await copyReviewText('日本語\n予定', document.body)).toBe(true); expect(writeText).toHaveBeenCalledWith('日本語\n予定'); expect(legacy).not.toHaveBeenCalled();
});
it('APIが拒否されたら指定したカード内で全文を選択して互換コピーし、フォーカスとDOMを復元する', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(Error('denied')) } });
  const card = document.createElement('section'), button = document.createElement('button'); card.append(button); document.body.append(card); button.focus();
  const legacy = exec(true, () => { const field = document.activeElement as HTMLTextAreaElement; expect(field.parentElement).toBe(card); expect(field.value).toBe('互換コピー'); expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(5); });
  expect(await copyReviewText('互換コピー', card)).toBe(true); expect(legacy).toHaveBeenCalledWith('copy'); expect(document.activeElement).toBe(button); expect(card.querySelector('textarea')).toBeNull();
});
it.each([false, Error('unsupported')])('自動コピー失敗を成功として扱わず、一時DOMも残さない', async result => {
  vi.stubGlobal('navigator', {}); exec(result);
  expect(await copyReviewText('手動へ', document.body)).toBe(false); expect(document.querySelector('textarea')).toBeNull();
});
it('APIも互換コマンドもない環境では手動コピーへ渡す', async () => {
  vi.stubGlobal('navigator', {}); expect(await copyReviewText('手動へ', document.body)).toBe(false);
});
