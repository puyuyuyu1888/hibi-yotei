import { displayTitle, parseDate, validDate, type Entry, type Option } from './model';
import { formatElapsed, pointTime, timelineRows } from './timeline';

export const AI_REVIEW_REQUEST = `【AIへの最終確認依頼】

以下の予定について、最新の情報をインターネットで調査し、内容に誤りがないか最終確認してください。

特に、電車・バスなどの公共交通機関の時刻表を重点的に確認してください。

### 確認事項

1. 予定の日付と曜日が一致しているか。
2. 電車・バスの出発時刻と到着時刻が正しいか。
3. 予定日に実際に運行される列車・バスか。
4. 平日・土休日・祝日のダイヤが正しく適用されているか。
5. 乗車駅、降車駅、停留所、路線、行き先が正しいか。
6. 乗り換え時間に無理がないか。
7. 駅構内や停留所間の移動時間が考慮されているか。
8. 予定にある移動時間が現実的か。
9. ダイヤ改正、工事、運休、運行変更など、予定に影響する情報がないか。
10. その他の予定についても、時間の矛盾や無理な移動がないか。

### 調査方法

- 最新の情報をインターネットで検索する。
- 鉄道会社・バス会社などの公式サイトを優先する。
- 公式時刻表と、対象の日付に適用される運行カレンダーを確認する。
- 公式情報が確認できない場合は、信頼できる経路検索サービスなども参考にする。
- 情報源のURLを提示する。
- 古い時刻表を現在のものとして扱わない。
- 予定の日時点で適用されるダイヤかどうか確認する。
- 調査時点でまだ発表されていない運行情報は、確認不能と明記する。
- リアルタイム運行状況を確認できない場合は、そのことを明記する。

### 情報不足の場合

駅名、停留所名、路線名、乗車区間など、予定の確認に必要な情報が不足している場合は、推測で確定しないでください。

特定できない情報を明示し、必要に応じて質問してください。

特に、時刻だけから特定の列車やバスを勝手に断定しないでください。

### 回答形式

結果を次の3種類に分類してください。

【確認できた項目】
公式情報などによって確認できた内容。

【修正が必要な項目】
時刻・乗り換え・移動時間などに誤りがある内容。正しい情報と修正案を提示する。

【未確認・情報不足の項目】
情報不足や未発表などの理由で確認できなかった内容。

最後に、予定をそのまま使用できるか、修正が必要か、追加情報が必要かを簡潔にまとめてください。

確認できていない事項を、問題がないと断定しないでください。`;

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
// Accept only schedule fields: the day title, memo and settings never enter this formatter.
export function buildAiReview(date: string, entries: readonly Entry[], titles: readonly Option[]): string | null {
  if (!entries.length) return null;
  if (!validDate(date)) throw new Error('日付が不正です。');
  const day = parseDate(date), next = parseDate(date);
  next.setDate(next.getDate() + 1);
  const nextLabel = `${next.getFullYear() !== day.getFullYear() ? `${next.getFullYear()}年` : ''}${next.getMonth() + 1}月${next.getDate()}日（${weekdays[next.getDay()]}）`;
  const lines = timelineRows(entries).map(row => row.kind === 'time'
    ? `${pointTime(row.entry)}${row.entry.nextDay ? `［${nextLabel}］` : ''}　${displayTitle(row.entry, titles)}`
    : `${row.entry.elapsedTitle}（${formatElapsed(row.minutes)}）`);
  return `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日（${weekdays[day.getDay()]}）\n\n${lines.join('\n')}\n\n---\n\n${AI_REVIEW_REQUEST}`;
}

// The compatibility field must be inside the active dialog; background DOM is inert.
export async function copyReviewText(text: string, container: HTMLElement): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Local-file viewers may deny the Clipboard API. Try selection-based copying. */ }
  const active = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement('textarea');
  field.value = text; field.readOnly = true; field.tabIndex = -1;
  field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  try {
    container.appendChild(field); field.focus({ preventScroll: true }); field.select(); field.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
  } catch { return false; }
  finally {
    field.remove();
    if (active?.isConnected) active.focus({ preventScroll: true });
    if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); }
  }
}
